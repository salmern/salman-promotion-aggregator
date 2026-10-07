/**
 * Listing page scraper: /sales
 *
 * Real page structure (confirmed from fixture inspection):
 *   .deal-row            — one per promotion (may repeat for same deal)
 *     data-store-id      — numeric brand ID (e.g. "1035991")
 *     data-alpha         — brand slug name (e.g. "aerie", "Bath Body Works")
 *     data-start / data-end — OA date serials (unused; we parse ends text)
 *     a[href="/deals/N/"] — link to deal detail page
 *       .deal-image img  — thumbnail
 *       .major           — promotion name
 *       .minor           — "Ends Today" / "Ends 10/19" etc.
 *
 * Deduplication: same deal ID may appear multiple times (category filtering artifact).
 */
import * as cheerio from 'cheerio';
import { extractDealId } from './dateParser';
import type { Page } from 'playwright';

export interface ListingPromoStub {
  /** Numeric deal ID from /deals/{id}/ URL */
  sourceId: string;
  name: string;
  brandName: string;
  /** Numeric store ID from data-store-id attribute */
  storeId: string | null;
  dealUrl: string;
  imageUrl: string | null;
  /** Raw "Ends ..." text */
  endsText: string | null;
}

/**
 * Scrape the live /sales listing page using Playwright.
 */
export async function scrapeListingPage(page: Page): Promise<ListingPromoStub[]> {
  // Wait for deal cards to render
  await page.waitForSelector('.deal-row', { timeout: 15_000 }).catch(() => null);
  const html = await page.content();
  return parseListingHtml(html);
}

/**
 * Parse listing HTML. Used by both live scraper and parser tests.
 */
export function parseListingHtml(html: string): ListingPromoStub[] {
  const $ = cheerio.load(html);
  const results: ListingPromoStub[] = [];
  const seen = new Set<string>();

  $('.deal-row').each((_, el) => {
    const $row = $(el);
    const $link = $row.find('a[href*="/deals/"]').first();
    const href = $link.attr('href') ?? '';

    const sourceId = extractDealId(href);
    if (!sourceId) return;

    // Deduplicate — same deal shows multiple times due to category filtering
    if (seen.has(sourceId)) return;
    seen.add(sourceId);

    const name = $row.find('.major').first().text().trim();
    if (!name) return;

    const brandName = $row.find('.minor').not('[class*="motice"]').first().text().trim()
      || $row.attr('data-alpha')?.replace(/-/g, ' ') 
      || '';

    const endsText = $row.find('.minor').first().text().trim() || null;

    const storeId = $row.attr('data-store-id') ?? null;

    const imgSrc = $row.find('img').first().attr('src') ?? null;
    const imageUrl = imgSrc ? normalizeImageUrl(imgSrc) : null;

    const dealUrl = href.startsWith('http')
      ? href
      : `https://www.thepromenadeshopsatbriargate.com${href}`;

    results.push({
      sourceId,
      name,
      brandName,
      storeId,
      dealUrl,
      imageUrl,
      endsText,
    });
  });

  return results;
}

function normalizeImageUrl(src: string): string {
  if (src.startsWith('http')) return src;
  if (src.startsWith('//')) return `https:${src}`;
  return `https://www.thepromenadeshopsatbriargate.com${src}`;
}
