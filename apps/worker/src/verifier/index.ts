/**
 * Verification orchestrator.
 *
 * For each non-'gone' promotion in the DB:
 *  1. Re-fetch the detail page from the live source.
 *  2. Parse it with the same parser used for scraping.
 *  3. Diff against stored values.
 *  4. Record discrepancies.
 *
 * A promotion that returns 404/410 → discrepancy type 'gone'.
 * A page that fails to load → 'unverifiable' with reason.
 * A page where fields differ → 'changed' with before/after per field.
 */
import pino from 'pino';
import { openPage, closePage, closeBrowser } from '../scraper/browser';
import { parseDetailHtml } from '../scraper/detail';
import { parseEndDate } from '../scraper/dateParser';
import { diffPromotion } from './diff';
import type { Db } from '@promotions/db';
import {
  getAllPromotionsForVerification,
  updateVerificationStatus,
  updateVerificationRun,
  insertDiscrepancy,
  getVerificationRun,
} from '@promotions/db';

const logger = pino({ name: 'verifier', level: process.env['LOG_LEVEL'] ?? 'info' });

export interface VerifyOptions {
  db: Db;
  runId: number;
}

export async function runVerification(options: VerifyOptions): Promise<void> {
  const { db, runId } = options;
  const verifiedAt = new Date();

  let checkedCount = 0;
  let discrepancyCount = 0;
  let failedCount = 0;

  try {
    const promotions = await getAllPromotionsForVerification(db);
    logger.info({ runId, count: promotions.length }, 'Starting verification');

    for (const promo of promotions) {
      checkedCount++;

      try {
        logger.info({ runId, sourceId: promo.sourceId }, 'Verifying promotion');

        const page = await openPage(promo.canonicalUrl);
        let isGone = false;
        let html = '';

        try {
          // Track the response status directly — no need for page.evaluate
          let responseStatus = 200;
          page.on('response', (res) => {
            if (res.url() === promo.canonicalUrl || res.url() === `${promo.canonicalUrl}/`) {
              responseStatus = res.status();
            }
          });

          html = await page.content();
          const finalUrl = page.url();

          // Gone if: HTTP 404/410, or redirected away from a deal URL
          isGone =
            responseStatus === 404 ||
            responseStatus === 410 ||
            (!finalUrl.includes('/deals/'));
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
          continue;
        }

        // Parse fresh data
        const fresh = parseDetailHtml(html);
        const freshEndDate = parseEndDate(fresh.endsText, verifiedAt);
        const freshStartDate = fresh.startsText ? parseEndDate(fresh.startsText, verifiedAt) : null;

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
