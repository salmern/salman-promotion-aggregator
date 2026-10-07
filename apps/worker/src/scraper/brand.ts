/**
 * Brand store page scraper: /stores/{id}-{slug}/
 *
 * Real page structure (confirmed from fixture inspection):
 *   h1                    — brand name (clean)
 *   .hours-item           — contains: "Hours:\nMon – Sat: 10am – 8pmSun: 11am – 6pm"
 *                           (entries are concatenated with NO separator between them)
 *   a[href="View Website »"] — brand external website (shopstyle.it redirect)
 *
 * IMPORTANT NOTE (see ASSUMPTIONS.md):
 *   Social links on brand pages belong to the MALL (ShopsBriargate), not the brand.
 *   We do NOT capture mall social links as brand social links.
 *   socialLinks: [] always for this portal.
 */
import * as cheerio from 'cheerio';
import type { HoursEntry, SocialLink } from '@promotions/shared';

export interface BrandPageData {
  name: string;
  websiteUrl: string | null;
  hours: HoursEntry[];
  hoursRaw: string | null;
  socialLinks: SocialLink[];
  description: string | null;
}

const MALL_DOMAINS = [
  'thepromenadeshopsatbriargate.com',
  'x.com/ShopsBriargate',
  'facebook.com/ShopsBriargate',
  'instagram.com/shopsbriargate',
  'placewise.com',
  'hines.com',
];

export function parseBrandHtml(html: string): BrandPageData {
  const $ = cheerio.load(html);

  const name =
    $('h1').first().text().trim() ||
    $('title')
      .text()
      .replace(/The Promenade Shops at Briargate\s*::\s*/i, '')
      .replace(/placewise logo/gi, '')
      .trim() ||
    '';

  const websiteUrl = extractWebsiteUrl($);
  const { hours, hoursRaw } = extractHours($);
  const socialLinks: SocialLink[] = [];

  const description = (() => {
    let best = '';
    $('p, .store-description, [class*="description"], [class*="about"]').each((_, el) => {
      const t = $(el).text().trim();
      if (
        t.length > 60 &&
        t.length > best.length &&
        t.length < 2000 &&
        !/copyright|privacy|terms|powered by/i.test(t) &&
        !/^\d/.test(t)
      ) {
        best = t;
      }
    });
    return best || null;
  })();

  return { name, websiteUrl, hours, hoursRaw: hoursRaw || null, socialLinks, description };
}

function extractWebsiteUrl($: cheerio.CheerioAPI): string | null {
  let found: string | null = null;
  $('a[href]').each((_, el) => {
    if (found) return;
    const href = $(el).attr('href') ?? '';
    const text = $(el).text().trim();
    if (!href.startsWith('http')) return;
    if (MALL_DOMAINS.some((d) => href.toLowerCase().includes(d.toLowerCase()))) return;
    if (/view\s+website/i.test(text)) {
      found = href;
    }
  });
  return found;
}

function extractHours($: cheerio.CheerioAPI): { hours: HoursEntry[]; hoursRaw: string } {
  // Get the raw hours text from .hours-item, stripping the "Hours:" label
  const hoursRaw = $('.hours-item')
    .first()
    .text()
    .replace(/^Hours:\s*/i, '')
    .trim();

  if (!hoursRaw) {
    // Fallback: .opening-hours text
    const openingText = $('.opening-hours').first().text().replace(/\s+/g, ' ').trim();
    if (openingText) {
      return { hours: parseHoursString(openingText), hoursRaw: openingText };
    }
    return { hours: [], hoursRaw: '' };
  }

  return { hours: parseHoursString(hoursRaw), hoursRaw };
}

/**
 * Parses a hours string into structured HoursEntry[].
 *
 * Handles the real format from the fixture:
 *   "Mon – Sat: 10am – 8pmSun: 11am – 6pm"  ← no separator between entries
 *   "Mon – Sat: 10am – 8pm\nSun: 11am – 6pm" ← newline separated
 *   "Mon - Fri: 9am - 5pm"                   ← ASCII dashes
 *
 * Strategy: use a global regex to find ALL "days: open – close" patterns
 * in the string, regardless of what separates them.
 *
 * Exported for use in tests.
 */
export function parseHoursString(raw: string): HoursEntry[] {
  if (!raw) return [];

  // Strip zero-width chars and normalize whitespace
  const cleaned = raw
    .replace(/[\u2060\u200b\u200c\u200d\ufeff\u00ad]/g, '') // zero-width
    .replace(/\s+/g, ' ')
    .trim();

  const results: HoursEntry[] = [];

  // Global pattern: greedily match "some days text: HH[am/pm] [–/-] HH[am/pm]"
  // The days part stops at the colon, time part is non-greedy
  // We use a global exec loop to find ALL matches in the string
  const pattern =
    /([A-Za-z][^:]{0,30}?):\s*(\d{1,2}(?::\d{2})?[ap]m)\s*[–\-]\s*(\d{1,2}(?::\d{2})?[ap]m)/gi;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(cleaned)) !== null) {
    const days = match[1]?.trim() ?? '';
    const open = match[2]?.trim() ?? '';
    const close = match[3]?.trim() ?? '';
    if (days && open && close) {
      results.push({ days, open, close });
    }
  }

  return results;
}
