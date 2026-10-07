/**
 * Scraper orchestrator.
 *
 * Flow:
 *  1. Scrape /sales listing → collect promotion stubs (with storeId)
 *  2. For each stub, fetch /deals/{id}/ detail page
 *  3. For each unique brand, fetch /stores/{id}-{slug}/ brand page
 *  4. Normalize dates (Denver-aware), build records
 *  5. Persist via DB repositories (upsert)
 *
 * Key: storeId from listing card data-store-id maps directly to the
 * /stores/{storeId}-{slug}/ URL pattern. We use it to build the brand key.
 */
import pino from 'pino';
import { openPage, closePage, closeBrowser, BASE_URL } from './browser';
import { scrapeListingPage } from './listing';
import type { ListingPromoStub } from './listing';
import { parseDetailHtml } from './detail';
import { parseBrandHtml } from './brand';
import { parseEndDate, extractBrandKey } from './dateParser';
import type { Db } from '@promotions/db';
import { upsertBrand, upsertPromotion, getBrandByKey } from '@promotions/db';
import type { HoursEntry, SocialLink } from '@promotions/shared';

const logger = pino({ name: 'scraper', level: process.env['LOG_LEVEL'] ?? 'info' });

const SOURCE_PORTAL = 'thepromenadeshopsatbriargate';

export interface ScrapeProgress {
  attempted: number;
  persisted: number;
  updated: number;
  skipped: number;
  failed: number;
}

export interface ScrapeOptions {
  db: Db;
  onProgress?: (progress: ScrapeProgress) => Promise<void>;
  isCancelled?: () => Promise<boolean>;
}

/**
 * Named error for cooperative cancellation.
 */
export class CancellationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CancellationError';
  }
}

/**
 * Run a full scrape. Returns final counts.
 */
export async function runScrape(options: ScrapeOptions): Promise<ScrapeProgress> {
  const { db, onProgress, isCancelled } = options;
  const progress: ScrapeProgress = {
    attempted: 0,
    persisted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };

  const scrapedAt = new Date();

  try {
    // ── Step 1: Listing page ────────────────────────────────────────────────
    logger.info('Scraping listing page /sales...');
    const listingPage = await openPage('/sales');
    let stubs: ListingPromoStub[];
    try {
      stubs = await scrapeListingPage(listingPage);
    } finally {
      await closePage(listingPage);
    }

    logger.info({ count: stubs.length }, 'Found promotion stubs on listing');

    if (stubs.length === 0) {
      logger.warn('No promotions found — site structure may have changed');
      return progress;
    }

    // Brand page cache: brandKey → DB id (avoid re-scraping same brand)
    const brandIdCache = new Map<string, number>();

    // ── Step 2: Process each promotion ─────────────────────────────────────
    for (const stub of stubs) {
      if (isCancelled && (await isCancelled())) {
        logger.info('Scrape cancelled');
        throw new CancellationError('Cancelled by user');
      }

      progress.attempted++;

      try {
        // ── 2a: Detail page ───────────────────────────────────────────────
        logger.info({ sourceId: stub.sourceId }, 'Fetching detail page');
        const detailPage = await openPage(stub.dealUrl);
        let detailHtml: string;
        try {
          detailHtml = await detailPage.content();
        } finally {
          await closePage(detailPage);
        }

        const detail = parseDetailHtml(detailHtml);
        const name = detail.name || stub.name;
        if (!name) {
          logger.warn({ sourceId: stub.sourceId }, 'No name — skipping');
          progress.failed++;
          continue;
        }

        // ── 2b: Resolve brand key ─────────────────────────────────────────
        // Primary: brand key from detail page store link (most reliable)
        // Fallback: construct from storeId + alpha slug from listing card
        let brandKey: string | null = detail.brandKey;

        if (!brandKey && stub.storeId) {
          // We have the numeric store ID; we need the slug.
          // The detail page store link gives us the full key, but as fallback
          // we construct an approximate key. It will be corrected next time
          // the brand page is visited via store link.
          brandKey = null; // will use storeId-based URL below
        }

        const brandName = detail.brandName || stub.brandName;

        // ── 2c: Brand page ────────────────────────────────────────────────
        let brandId: number;
        const cacheKey = brandKey || (stub.storeId ? `storeid-${stub.storeId}` : `unknown-${stub.sourceId}`);

        if (brandIdCache.has(cacheKey)) {
          brandId = brandIdCache.get(cacheKey)!;
        } else {
          let brandData: {
            websiteUrl: string | null;
            hours: HoursEntry[];
            hoursRaw: string | null;
            socialLinks: SocialLink[];
            resolvedKey: string;
            resolvedName: string;
            storeUrl: string | null;
          } | null = null;

          // Determine store URL for brand page
          const storeUrl = detail.brandStoreUrl
            || (stub.storeId ? null : null); // We need slug for URL; detail page gives us it

          if (storeUrl) {
            const resolvedKey = brandKey || extractBrandKey(storeUrl) || cacheKey;
            const existing = await getBrandByKey(db, resolvedKey);

            // Only re-scrape if brand is fresh-enough or missing
            if (!existing || shouldRefreshBrand(existing.scrapedAt, scrapedAt)) {
              logger.info({ brandKey: resolvedKey, storeUrl }, 'Fetching brand page');
              try {
                const brandPage = await openPage(storeUrl);
                let brandHtml: string;
                try {
                  brandHtml = await brandPage.content();
                } finally {
                  await closePage(brandPage);
                }
                const parsed = parseBrandHtml(brandHtml);
                brandData = {
                  websiteUrl: parsed.websiteUrl,
                  hours: parsed.hours,
                  hoursRaw: parsed.hoursRaw,
                  socialLinks: parsed.socialLinks,
                  resolvedKey,
                  resolvedName: parsed.name || brandName || resolvedKey,
                  storeUrl,
                };
              } catch (brandErr) {
                logger.warn({ brandKey: resolvedKey, err: String(brandErr) }, 'Brand page fetch failed');
                brandData = {
                  websiteUrl: existing?.websiteUrl ?? null,
                  hours: (existing?.hours as HoursEntry[]) ?? [],
                  hoursRaw: existing?.hoursRaw ?? null,
                  socialLinks: (existing?.socialLinks as SocialLink[]) ?? [],
                  resolvedKey,
                  resolvedName: existing?.name || brandName || resolvedKey,
                  storeUrl,
                };
              }
            } else {
              brandData = {
                websiteUrl: existing.websiteUrl ?? null,
                hours: (existing.hours as HoursEntry[]) ?? [],
                hoursRaw: existing.hoursRaw ?? null,
                socialLinks: (existing.socialLinks as SocialLink[]) ?? [],
                resolvedKey,
                resolvedName: existing.name,
                storeUrl,
              };
            }
          } else {
            // No store URL available — create minimal brand record
            const resolvedKey = cacheKey;
            brandData = {
              websiteUrl: null,
              hours: [],
              hoursRaw: null,
              socialLinks: [],
              resolvedKey,
              resolvedName: brandName || resolvedKey,
              storeUrl: null,
            };
          }

          brandId = await upsertBrand(db, {
            sourceBrandKey: brandData.resolvedKey,
            name: brandData.resolvedName,
            websiteUrl: brandData.websiteUrl,
            hours: brandData.hours,
            hoursRaw: brandData.hoursRaw,
            socialLinks: brandData.socialLinks,
            sourceUrl: brandData.storeUrl,
            scrapedAt,
          });

          brandIdCache.set(cacheKey, brandId);
          if (brandKey && brandKey !== cacheKey) brandIdCache.set(brandKey, brandId);
        }

        // ── 2d: Parse dates ────────────────────────────────────────────────
        const endsText = detail.endsText || stub.endsText;
        const endDate = parseEndDate(endsText, scrapedAt);
        const startDate = detail.startsText ? parseEndDate(detail.startsText, scrapedAt) : null;

        // ── 2e: Upsert promotion ───────────────────────────────────────────
        const { result } = await upsertPromotion(db, {
          sourceId: stub.sourceId,
          brandId,
          name,
          description: detail.description,
          imageUrl: detail.imageUrl || stub.imageUrl,
          startDate,
          endDate,
          canonicalUrl: stub.dealUrl,
          sourcePortal: SOURCE_PORTAL,
          scrapedAt,
          verificationStatus: 'pending',
        });

        if (result === 'inserted') progress.persisted++;
        else if (result === 'updated') progress.updated++;
        else progress.skipped++;

        logger.info({ sourceId: stub.sourceId, result }, 'Promotion processed');
      } catch (err) {
        if (err instanceof CancellationError) throw err;
        logger.error(
          { sourceId: stub.sourceId, err: String(err) },
          'Failed to process promotion'
        );
        progress.failed++;
      }

      if (onProgress) await onProgress({ ...progress });
    }
  } finally {
    await closeBrowser();
  }

  logger.info(progress, 'Scrape complete');
  return progress;
}

function shouldRefreshBrand(scrapedAt: Date, runStart: Date): boolean {
  return runStart.getTime() - scrapedAt.getTime() > 60 * 60 * 1000;
}
