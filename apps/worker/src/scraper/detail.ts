/**
 * Promotion detail page scraper: /deals/{id}/
 *
 * Real page structure (confirmed from fixture inspection):
 *   h1                               — promotion name
 *   meta[property="og:image"]        — high-res promo image
 *   meta[property="og:description"]  — description (clean text)
 *   .notice.notice--ends-*           — "Ends Today" / "Ends 10/19" etc.
 *   .deal-detail-flyer img           — fallback image
 *   a[href*="/stores/"]              — brand store page link
 *   .deal-detail-description         — long description text
 *
 * Social links on brand pages belong to the mall, not individual brands.
 * We extract only brand-specific data here.
 */
import * as cheerio from 'cheerio';
import { extractBrandKey } from './dateParser';

export interface DetailPageData {
  name: string;
  description: string | null;
  imageUrl: string | null;
  /** Raw "Ends ..." text from .notice element */
  endsText: string | null;
  startsText: string | null;
  brandStoreUrl: string | null;
  brandKey: string | null;
  brandName: string | null;
}

const BASE = 'https://www.thepromenadeshopsatbriargate.com';

/**
 * Parse detail page HTML.
 */
export function parseDetailHtml(html: string): DetailPageData {
  const $ = cheerio.load(html);

  // Promotion name — h1 is reliable
  const name = $('h1').first().text().trim()
    || $('meta[property="og:title"]').attr('content')?.replace(/\s+at\s+.+$/, '').trim()
    || '';

  // Description — og:description is cleaner than scraped body text
  const description =
    $('meta[property="og:description"]').attr('content')?.trim()
    || $('.deal-detail-description').text().trim()
    || $('.deal-detail-info').find('p').first().text().trim()
    || null;

  // Image — og:image is the high-res version
  const rawImage =
    $('meta[property="og:image"]').attr('content')
    || $('.deal-detail-flyer img').first().attr('src')
    || null;

  const imageUrl = rawImage ? normalizeUrl(rawImage) : null;

  // End date text — class pattern: notice notice--ends-today, notice notice--ends-MMDD etc.
  const endsText =
    $('[class*="notice--ends"]').first().text().trim()
    || $('[class*="motice--ends"]').first().text().trim()
    || (() => {
      // fallback: find any text node matching "Ends ..."
      let found: string | null = null;
      $('*').each((_, el) => {
        const own = $(el).clone().children().remove().end().text().trim();
        if (!found && /^ends\s+/i.test(own) && own.length < 30) {
          found = own;
        }
      });
      return found;
    })();

  // Start date text
  const startsText = (() => {
    let found: string | null = null;
    $('*').each((_, el) => {
      const own = $(el).clone().children().remove().end().text().trim();
      if (!found && /^starts?\s+/i.test(own) && own.length < 30) {
        found = own;
      }
    });
    return found;
  })();

  // Brand store page link — most reliable brand signal
  const storeHref = $('a[href*="/stores/"]').first().attr('href') ?? null;
  const brandStoreUrl = storeHref
    ? (storeHref.startsWith('http') ? storeHref : `${BASE}${storeHref}`)
    : null;

  const brandKey = brandStoreUrl ? extractBrandKey(brandStoreUrl) : null;

  // Brand name — from og:title "X at Brand Name" pattern
  const ogTitle = $('meta[property="og:title"]').attr('content') ?? '';
  const brandMatch = /\bat\s+(.+)$/i.exec(ogTitle);
  const brandName = brandMatch?.[1]?.trim() 
    || $('a[href*="/stores/"]').first().text().trim() 
    || null;

  return {
    name,
    description: description || null,
    imageUrl,
    endsText: endsText || null,
    startsText: startsText || null,
    brandStoreUrl,
    brandKey,
    brandName,
  };
}

function normalizeUrl(url: string): string {
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return `${BASE}${url}`;
}
