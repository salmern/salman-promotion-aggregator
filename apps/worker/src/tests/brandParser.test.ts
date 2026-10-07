/**
 * Brand page parser tests.
 * Runs against the committed HTML fixture (lululemon store page).
 *
 * Verifies:
 *  - Brand name extracted from h1
 *  - Hours parsed into structured HoursEntry[]
 *  - Website URL extracted (shopstyle.it redirect)
 *  - Social links array is empty (mall's socials, not brand's — see ASSUMPTIONS.md)
 *  - parseHoursString works correctly for various input formats
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseBrandHtml, parseHoursString } from '../scraper/brand';
import type { BrandPageData } from '../scraper/brand';

const FIXTURE = path.join(__dirname, '../../../../tests/fixtures/brand.html');

let html: string;
let brand: BrandPageData;

beforeAll(() => {
  html = fs.readFileSync(FIXTURE, 'utf-8');
  brand = parseBrandHtml(html);
});

describe('parseBrandHtml', () => {
  it('extracts brand name as "lululemon"', () => {
    expect(brand.name.toLowerCase()).toBe('lululemon');
  });

  it('extracts a website URL', () => {
    expect(brand.websiteUrl).toBeTruthy();
    expect(brand.websiteUrl).toMatch(/^https:\/\//);
    // Should NOT be the mall portal itself
    expect(brand.websiteUrl).not.toContain('thepromenadeshopsatbriargate');
  });

  it('has an hours entry for weekdays', () => {
    expect(brand.hours.length).toBeGreaterThanOrEqual(1);
    const weekday = brand.hours.find((h) =>
      h.days.toLowerCase().includes('mon') || h.days.toLowerCase().includes('sat'),
    );
    expect(weekday).toBeDefined();
    expect(weekday?.open).toContain('am');
    expect(weekday?.close).toContain('pm');
  });

  it('has an hours entry for Sunday', () => {
    const sunday = brand.hours.find((h) => h.days.toLowerCase().includes('sun'));
    expect(sunday).toBeDefined();
    expect(sunday?.open).toBeTruthy();
    expect(sunday?.close).toBeTruthy();
  });

  it('has hoursRaw text', () => {
    expect(brand.hoursRaw).toBeTruthy();
    expect(brand.hoursRaw?.length).toBeGreaterThan(5);
  });

  it('socialLinks is empty (mall socials, not brand socials — per ASSUMPTIONS.md)', () => {
    // This portal only exposes mall social links, not individual brand links
    expect(brand.socialLinks).toEqual([]);
  });

  it('returns consistent results on repeated calls', () => {
    const brand2 = parseBrandHtml(html);
    expect(brand2.name).toBe(brand.name);
    expect(brand2.hours.length).toBe(brand.hours.length);
  });
});

describe('parseHoursString', () => {
  it('parses "Mon – Sat: 10am – 8pm" format', () => {
    const result = parseHoursString('Mon – Sat: 10am – 8pm');
    expect(result).toHaveLength(1);
    expect(result[0]?.days).toContain('Mon');
    expect(result[0]?.open).toBe('10am');
    expect(result[0]?.close).toBe('8pm');
  });

  it('parses multi-line hours', () => {
    const result = parseHoursString('Mon – Sat: 10am – 8pm\nSun: 11am – 6pm');
    expect(result).toHaveLength(2);
    expect(result[0]?.days).toContain('Mon');
    expect(result[1]?.days).toContain('Sun');
  });

  it('handles dashes instead of em-dashes', () => {
    const result = parseHoursString('Mon - Fri: 9am - 5pm');
    expect(result).toHaveLength(1);
    expect(result[0]?.open).toBe('9am');
    expect(result[0]?.close).toBe('5pm');
  });

  it('returns empty array for empty input', () => {
    expect(parseHoursString('')).toEqual([]);
  });

  it('returns empty array for unparseable input', () => {
    const result = parseHoursString('Contact store for hours');
    expect(result).toEqual([]);
  });

  it('handles 12-hour time with minutes', () => {
    const result = parseHoursString('Mon – Fri: 10:00am – 9:00pm');
    expect(result).toHaveLength(1);
    expect(result[0]?.open).toBe('10:00am');
  });
});
