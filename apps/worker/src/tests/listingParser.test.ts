/**
 * Listing parser tests.
 * Runs against the committed HTML fixture — NOT the live site.
 *
 * Verifies:
 *  - Correct number of unique promotions extracted
 *  - Required fields present on each promotion
 *  - Deduplication works (same deal appears multiple times in raw HTML)
 *  - Known promotion data matches fixture
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseListingHtml } from '../scraper/listing';
import type { ListingPromoStub } from '../scraper/listing';

const FIXTURE = path.join(__dirname, '../../../../tests/fixtures/listing.html');

let html: string;
let stubs: ListingPromoStub[];

beforeAll(() => {
  html = fs.readFileSync(FIXTURE, 'utf-8');
  stubs = parseListingHtml(html);
});

describe('parseListingHtml', () => {
  it('extracts at least 20 unique promotions', () => {
    expect(stubs.length).toBeGreaterThanOrEqual(20);
  });

  it('deduplicates — no two stubs have the same sourceId', () => {
    const ids = stubs.map((s) => s.sourceId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('every stub has a non-empty sourceId', () => {
    for (const stub of stubs) {
      expect(stub.sourceId).toBeTruthy();
      expect(/^\d+$/.test(stub.sourceId)).toBe(true);
    }
  });

  it('every stub has a non-empty name', () => {
    for (const stub of stubs) {
      expect(stub.name.trim().length).toBeGreaterThan(0);
    }
  });

  it('every stub has a valid dealUrl pointing to /deals/', () => {
    for (const stub of stubs) {
      expect(stub.dealUrl).toMatch(/\/deals\/\d+/);
    }
  });

  it('storeId is present and numeric for all stubs', () => {
    for (const stub of stubs) {
      expect(stub.storeId).toBeTruthy();
      expect(/^\d+$/.test(stub.storeId ?? '')).toBe(true);
    }
  });

  it('endsText is present for at least half of stubs', () => {
    const withEnds = stubs.filter((s) => s.endsText !== null);
    expect(withEnds.length).toBeGreaterThanOrEqual(Math.floor(stubs.length / 2));
  });

  it('knows about aerie promotion', () => {
    const aerie = stubs.find((s) => s.name.toLowerCase().includes('pajama'));
    expect(aerie).toBeDefined();
    expect(aerie?.storeId).toBe('1035991');
  });

  it('knows about lululemon promotions', () => {
    const lulu = stubs.filter((s) => s.storeId === '1036011');
    expect(lulu.length).toBeGreaterThanOrEqual(1);
  });

  it('image URLs are https when present', () => {
    for (const stub of stubs) {
      if (stub.imageUrl) {
        expect(stub.imageUrl).toMatch(/^https:\/\//);
      }
    }
  });

  it('returns same results on repeated calls (deterministic)', () => {
    const stubs2 = parseListingHtml(html);
    expect(stubs2.length).toBe(stubs.length);
    expect(stubs2.map((s) => s.sourceId)).toEqual(stubs.map((s) => s.sourceId));
  });
});
