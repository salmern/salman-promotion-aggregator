/**
 * Detail page parser tests.
 * Runs against the committed HTML fixture (25% off Pajamas / aerie).
 *
 * Verifies:
 *  - Name extracted correctly
 *  - Description extracted from og:description
 *  - Image URL is the CDN URL
 *  - Brand store link points to /stores/...
 *  - Brand key extracted correctly
 *  - End date text present
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseDetailHtml } from '../scraper/detail';
import type { DetailPageData } from '../scraper/detail';

const FIXTURE = path.join(__dirname, '../../../../tests/fixtures/detail.html');

let html: string;
let detail: DetailPageData;

beforeAll(() => {
  html = fs.readFileSync(FIXTURE, 'utf-8');
  detail = parseDetailHtml(html);
});

describe('parseDetailHtml', () => {
  it('extracts the promotion name from h1', () => {
    expect(detail.name).toBe('25% off Pajamas');
  });

  it('extracts description from og:description meta tag', () => {
    expect(detail.description).toBeTruthy();
    expect(detail.description).toContain('25% off pajamas');
  });

  it('description does not include boilerplate terms', () => {
    // Should not include random nav/footer text
    expect(detail.description?.length).toBeLessThan(500);
  });

  it('extracts a valid https image URL', () => {
    expect(detail.imageUrl).toBeTruthy();
    expect(detail.imageUrl).toMatch(/^https:\/\//);
    expect(detail.imageUrl).toContain('placewise.com');
  });

  it('finds the brand store link', () => {
    expect(detail.brandStoreUrl).toBeTruthy();
    expect(detail.brandStoreUrl).toContain('/stores/');
    expect(detail.brandStoreUrl).toContain('aerie');
  });

  it('extracts the correct brand key', () => {
    expect(detail.brandKey).toBe('1035991-aerie');
  });

  it('extracts brand name as "aerie"', () => {
    expect(detail.brandName?.toLowerCase()).toBe('aerie');
  });

  it('extracts "Ends Today" text', () => {
    expect(detail.endsText).toBeTruthy();
    expect(detail.endsText?.toLowerCase()).toContain('ends');
  });

  it('returns consistent results on repeated calls', () => {
    const detail2 = parseDetailHtml(html);
    expect(detail2.name).toBe(detail.name);
    expect(detail2.brandKey).toBe(detail.brandKey);
  });
});
