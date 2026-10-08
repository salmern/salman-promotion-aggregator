/**
 * Verification orchestrator.
 *
 * For each non-'gone' promotion in the DB:
 *  1. Re-fetch the detail page from the live source.
 *  2. Detect 'gone' by checking final URL after navigation (not response listener).
 *  3. Parse fresh data and diff against stored promotion fields.
 *  4. Re-fetch the brand page and diff brand hours against stored data.
 *  5. Record all discrepancies with before/after values.
 *
 * Fix A: 'gone' detection now uses page.url() after navigation instead of
 *        page.on('response') which fires before the listener is registered.
 *
 * Fix B: Brand hours are now verified by re-scraping the brand page.
 *        Mutation 2 (hours change) is now detected.
 */
import pino from 'pino';
import { openPage, closePage, closeBrowser } from '../scraper/browser';
import { parseDetailHtml } from '../scraper/detail';
import { parseBrandHtml } from '../scraper/brand';
import { parseEndDate } from '../scraper/dateParser';
import { diffPromotion } from './diff';
import type { Db } from '@promotions/db';
import {
  getAllPromotionsForVerification,
  updateVerificationStatus,
  updateVerificationRun,
  insertDiscrepancy,
} from '@promotions/db';
import type { HoursEntry } from '@promotions/shared';

const logger = pino({ name: 'verifier', level: process.env['LOG_LEVEL'] ?? 'info' });

export interface VerifyOptions {
  db: Db;
  runId: number;
}

/**
 * Normalize hours to a comparable string.
 * Strips whitespace and unicode joiners so minor formatting differences
 * don't count as drift.
 */
function normalizeHours(hours: HoursEntry[]): string {
  return JSON.stringify(
    hours.map((h) => ({
      days: h.days.replace(/[\u2060\u200b\u200c\u200d\ufeff]/g, '').trim(),
      open: h.open.trim(),
      close: h.close.trim(),
    })),
  );
}

export async function runVerification(options: VerifyOptions): Promise<void> {
  const { db, runId } = options;
  const verifiedAt = new Date();

  let checkedCount = 0;
  let discrepancyCount = 0;
  let failedCount = 0;

  // Cache brand pages already re-scraped this run — don't hit same URL twice
  const brandPageCache = new Map<number, { hours: HoursEntry[]; hoursRaw: string | null }>();

  try {
    const promotions = await getAllPromotionsForVerification(db);
    logger.info({ runId, count: promotions.length }, 'Starting verification');

    for (const promo of promotions) {
      checkedCount++;

      try {
        logger.info({ runId, sourceId: promo.sourceId }, 'Verifying promotion');

        // ── Fix A: Gone detection via final URL ───────────────────────────
        // page.on('response') fires BEFORE the listener is registered because
        // openPage() already completes navigation. Instead we check the final
        // URL after navigation — if we're no longer on a /deals/ page, it's gone.
        const page = await openPage(promo.canonicalUrl);
        let isGone = false;
        let html = '';

        try {
          html = await page.content();
          const finalUrl = page.url();
          const pageTitle = await page.title();

          // Gone if: redirected away from a deal URL, OR page title indicates 404,
          // OR the page explicitly says "not found" in its content
          isGone =
            !finalUrl.includes('/deals/') ||
            /404|not found|page not found/i.test(pageTitle) ||
            html.toLowerCase().includes('not found in site');
        } finally {
          await closePage(page);
        }

        if (isGone) {
          await updateVerificationStatus(db, promo.id, 'gone');
          await insertDiscrepancy(db, {
            runId,
            promotionId: promo.id,
            brandId: promo.brandId,
            promotionName: promo.name,
            discrepancyType: 'gone',
            fieldName: null,
            beforeValue: promo.canonicalUrl,
            afterValue: null,
            reason: 'Promotion page no longer exists at source',
          });
          discrepancyCount++;
          // Still check brand even if promotion is gone
        } else {
          // ── Promotion field diff ────────────────────────────────────────
          const fresh = parseDetailHtml(html);
          const freshEndDate = parseEndDate(fresh.endsText, verifiedAt);
          const freshStartDate = fresh.startsText
            ? parseEndDate(fresh.startsText, verifiedAt)
            : null;

          const diffs = diffPromotion(
            {
              name: promo.name,
              description: promo.description,
              imageUrl: promo.imageUrl,
              endDate: promo.endDate,
              startDate: promo.startDate,
            },
            {
              name: fresh.name,
              description: fresh.description,
              imageUrl: fresh.imageUrl,
              endDate: freshEndDate,
              startDate: freshStartDate,
            },
          );

          if (diffs.length > 0) {
            for (const diff of diffs) {
              await insertDiscrepancy(db, {
                runId,
                promotionId: promo.id,
                brandId: promo.brandId,
                promotionName: promo.name,
                discrepancyType: 'changed',
                fieldName: diff.field,
                beforeValue: diff.before,
                afterValue: diff.after,
                reason: null,
              });
            }
            discrepancyCount++;
            await updateVerificationStatus(db, promo.id, 'changed');
          } else {
            await updateVerificationStatus(db, promo.id, 'verified');
          }
        }

        // ── Fix B: Brand hours verification ────────────────────────────────
        // Re-fetch brand page if not already done this run.
        // Compares stored hours against fresh scraped hours.
        // Note: promo.brand.hours comes from MySQL JSON column — may be a
        // raw string or already parsed array depending on driver. Normalize first.
        if (promo.brand.sourceUrl && !brandPageCache.has(promo.brandId)) {
          try {
            logger.info({ runId, brandId: promo.brandId, sourceUrl: promo.brand.sourceUrl }, 'Verifying brand page');
            const brandPage = await openPage(promo.brand.sourceUrl);
            let brandHtml = '';
            try {
              brandHtml = await brandPage.content();
            } finally {
              await closePage(brandPage);
            }

            const freshBrand = parseBrandHtml(brandHtml);
            brandPageCache.set(promo.brandId, {
              hours: freshBrand.hours,
              hoursRaw: freshBrand.hoursRaw,
            });

            // Normalize stored hours — MySQL JSON columns may come back as string
            const rawStoredHours = promo.brand.hours;
            const storedHours: HoursEntry[] = Array.isArray(rawStoredHours)
              ? (rawStoredHours as HoursEntry[])
              : typeof rawStoredHours === 'string'
                ? (JSON.parse(rawStoredHours) as HoursEntry[])
                : [];

            const freshHours = freshBrand.hours ?? [];

            const storedNorm = normalizeHours(storedHours);
            const freshNorm = normalizeHours(freshHours);

            if (storedNorm !== freshNorm && (storedHours.length > 0 || freshHours.length > 0)) {
              const storedStr = promo.brand.hoursRaw ?? JSON.stringify(storedHours);
              const freshStr = freshBrand.hoursRaw ?? JSON.stringify(freshHours);

              await insertDiscrepancy(db, {
                runId,
                promotionId: null,
                brandId: promo.brandId,
                promotionName: `[Brand: ${promo.brand.name}]`,
                discrepancyType: 'changed',
                fieldName: 'hours',
                beforeValue: storedStr,
                afterValue: freshStr,
                reason: null,
              });
              discrepancyCount++;
              logger.info({ runId, brandId: promo.brandId }, 'Brand hours discrepancy found');
            }

            // Compare websiteUrl
            const storedWebsite = promo.brand.websiteUrl ?? null;
            const freshWebsite = freshBrand.websiteUrl ?? null;
            if (storedWebsite !== freshWebsite) {
              await insertDiscrepancy(db, {
                runId,
                promotionId: null,
                brandId: promo.brandId,
                promotionName: `[Brand: ${promo.brand.name}]`,
                discrepancyType: 'changed',
                fieldName: 'websiteUrl',
                beforeValue: storedWebsite ?? 'null',
                afterValue: freshWebsite ?? 'null',
                reason: null,
              });
              discrepancyCount++;
            }
          } catch (brandErr) {
            logger.warn(
              { runId, brandId: promo.brandId, err: String(brandErr) },
              'Could not verify brand page — skipping brand check',
            );
            // Mark cache so we don't retry this brand
            brandPageCache.set(promo.brandId, { hours: [], hoursRaw: null });
          }
        }
      } catch (err) {
        logger.error(
          { runId, sourceId: promo.sourceId, err: String(err) },
          'Failed to verify promotion',
        );
        failedCount++;

        await insertDiscrepancy(db, {
          runId,
          promotionId: promo.id,
          brandId: promo.brandId,
          promotionName: promo.name,
          discrepancyType: 'unverifiable',
          fieldName: null,
          beforeValue: null,
          afterValue: null,
          reason: String(err),
        }).catch(() => undefined);

        await updateVerificationStatus(db, promo.id, 'unverifiable').catch(() => undefined);
      }

      // Update run counts after each promotion
      await updateVerificationRun(db, runId, {
        checkedCount,
        discrepancyCount,
        failedCount,
      }).catch(() => undefined);
    }

    await updateVerificationRun(db, runId, {
      status: 'completed',
      completedAt: new Date(),
      checkedCount,
      discrepancyCount,
      failedCount,
    });

    logger.info({ runId, checkedCount, discrepancyCount, failedCount }, 'Verification complete');
  } catch (err) {
    logger.error({ runId, err: String(err) }, 'Verification run failed');
    await updateVerificationRun(db, runId, {
      status: 'failed',
      completedAt: new Date(),
      checkedCount,
      discrepancyCount,
      failedCount,
      error: String(err),
    }).catch(() => undefined);
  } finally {
    await closeBrowser();
  }
}
