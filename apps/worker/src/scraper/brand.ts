/**
 * Brand store page scraper: /stores/{id}-{slug}/
 *
 * Real page structure (confirmed from fixture inspection):
 *   h1                    — brand name (clean)
 *   .hours-item           — contains hours text: "Hours:\nMon – Sat: 10am – 8pm\nSun: 11am – 6pm"
 *   .opening-hours        — structured hours in label/value elements
 *   a[href*="shopstyle.it"] or "View Website »" link — brand external website
 *
 * IMPORTANT NOTE (see ASSUMPTIONS.md):
 *   Social links on brand pages belong to the MALL (ShopsBriargate), not the brand.
 *   We do NOT capture mall social links as brand social links.
 *   Brand social links are not available on this portal → socialLinks: []
 *
 *   The "View Website »" link goes through shopstyle.it redirect.
 *   We store this redirect URL as websiteUrl; it is a valid external link.
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

/**
 * Parse brand store page HTML.
 */
export function parseBrandHtml(html: string): BrandPageData {
  const $ = cheerio.load(html);

  // Brand name
  const name =
    $('h1').first().text().trim()
    || $('title').text().replace(/The Promenade Shops at Briargate\s*::\s*/i, '')
         .replace(/placewise logo/gi, '').trim()
    || '';

  // Website URL
  const websiteUrl = extractWebsiteUrl($);

  // Hours
  const { hours, hoursRaw } = extractHours($);

  // Social links — mall portal does not expose individual brand socials
  const socialLinks: SocialLink[] = [];

  // Description — find the first substantial paragraph that isn't boilerplate
  const description = (() => {
    let best = '';
    $('p, .store-description, [class*="description"], [class*="about"]').each((_, el) => {
      const t = $(el).text().trim();
      if (
        t.length > 60 &&
        t.length > best.length &&
        t.length < 2000 &&
        !/copyright|privacy|terms|powered by/i.test(t) &&
        !/^\d/.test(t) // not an address
      ) {
        best = t;
      }
    });
    return best || null;
  })();

  return {
    name,
    websiteUrl,
    hours,
    hoursRaw: hoursRaw || null,
    socialLinks,
    description: description || null,
  };
}

function extractWebsiteUrl($: cheerio.CheerioAPI): string | null {
  // Find the "View Website »" anchor — this is the brand's external website
  let found: string | null = null;

  $('a[href]').each((_, el) => {
    if (found) return;
    const href = $(el).attr('href') ?? '';
    const text = $(el).text().trim();

    if (!href.startsWith('http')) return;

    // Skip mall-owned links
    if (MALL_DOMAINS.some((d) => href.toLowerCase().includes(d.toLowerCase()))) return;

    // "View Website »" is the primary signal
    if (/view\s+website/i.test(text)) {
      found = href;
      return;
    }
  });

  return found;
}

function extractHours($: cheerio.CheerioAPI): { hours: HoursEntry[]; hoursRaw: string } {
  // Primary: .opening-hours.general has the best structure
  // It contains label + value elements with days and times

  // Try structured approach first: .opening-hours
  const $openingHours = $('.opening-hours.general, .opening-hours').first();
  if ($openingHours.length) {
    const rawText = $openingHours.text()
      .replace(/\s+/g, ' ')
      .trim();

    // The hours text looks like: "Mon – Sat: 10am – 8pm Sun: 11am – 6pm"
    // Or comes from .hours-item with the label stripped
    const hoursRaw = $('.hours-item').first().text()
      .replace(/^Hours:\s*/i, '')
      .trim() || rawText;

    return {
      hours: parseHoursString(hoursRaw),
      hoursRaw,
    };
  }

  // Fallback: look for the .hours-item element
  const hoursItem = $('.hours-item').first().text().replace(/^Hours:\s*/i, '').trim();
  if (hoursItem) {
    return { hours: parseHoursString(hoursItem), hoursRaw: hoursItem };
  }

  return { hours: [], hoursRaw: '' };
}

/**
 * Parses a hours string like "Mon – Sat: 10am – 8pm Sun: 11am – 6pm"
 * into structured HoursEntry[].
 * Exported for use in tests.
 */
export function parseHoursString(raw: string): HoursEntry[] {
  if (!raw) return [];

  const results: HoursEntry[] = [];

  // Normalize dashes and special hyphens
  const normalized = raw
    .replace(/\u2013|\u2014|\u2010|\u2012|\u00ad/g, '-')
    .replace(/\s*-\s*/g, ' – ')
    .trim();

  // Split on newlines first, then try inline patterns
  const segments = normalized.split(/\n|(?=\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b)/);

  for (const seg of segments) {
    const trimmed = seg.replace(/\s+/g, ' ').trim();
    if (!trimmed) continue;

    // Pattern: "Mon – Sat: 10am – 8pm" or "Sun: 11am – 6pm"
    const match = /^(.+?):\s*(\d+(?::\d+)?[ap]m)\s*[–-]\s*(\d+(?::\d+)?[ap]m)/i.exec(trimmed);
    if (match?.[1] && match?.[2] && match?.[3]) {
      results.push({
        days: match[1].trim(),
        open: match[2].trim(),
        close: match[3].trim(),
      });
    }
  }

  // If segmented parsing failed, try whole-string pattern
  if (results.length === 0) {
    const wholeMatch = /(.+?):\s*(\d+(?::\d+)?[ap]m)\s*[–-]\s*(\d+(?::\d+)?[ap]m)/gi;
    let m: RegExpExecArray | null;
    while ((m = wholeMatch.exec(normalized)) !== null) {
      if (m[1] && m[2] && m[3]) {
        results.push({ days: m[1].trim(), open: m[2].trim(), close: m[3].trim() });
      }
    }
  }

  return results;
}
