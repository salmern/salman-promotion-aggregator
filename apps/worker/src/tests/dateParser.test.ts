/**
 * Date parser tests.
 * Tests Denver-timezone-aware date parsing logic.
 * Uses a fixed reference date so tests are deterministic.
 */
import { describe, it, expect } from 'vitest';
import { parseEndDate, extractDealId, extractBrandKey } from '../scraper/dateParser';

// Fixed reference: Wednesday October 7, 2026 at 10:00 AM Denver time
// = 2026-10-07T16:00:00.000Z (MDT = UTC-6)
const REF = new Date('2026-10-07T16:00:00.000Z');

describe('parseEndDate', () => {
  it('returns null for null input', () => {
    expect(parseEndDate(null, REF)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(parseEndDate(undefined, REF)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseEndDate('', REF)).toBeNull();
  });

  it('parses "Ends Today" as end-of-day on the reference date in Denver', () => {
    const result = parseEndDate('Ends Today', REF);
    expect(result).not.toBeNull();
    // Should be Oct 7, 2026 at 23:59:59 Denver time = Oct 8 05:59 UTC (MDT = UTC-6)
    const resultDate = result!;
    // Just verify it's after the reference time and within the same calendar day in Denver
    expect(resultDate.getTime()).toBeGreaterThan(REF.getTime());
    // And before the day after tomorrow
    const dayAfterTomorrow = new Date(REF.getTime() + 2 * 24 * 60 * 60 * 1000);
    expect(resultDate.getTime()).toBeLessThan(dayAfterTomorrow.getTime());
  });

  it('parses "Ends Tomorrow" as end-of-day the next Denver day', () => {
    const result = parseEndDate('Ends Tomorrow', REF);
    expect(result).not.toBeNull();
    const today = parseEndDate('Ends Today', REF)!;
    // Tomorrow's end-of-day should be about 24h after today's end-of-day
    expect(result!.getTime()).toBeGreaterThan(today.getTime());
    expect(result!.getTime() - today.getTime()).toBeCloseTo(24 * 60 * 60 * 1000, -3);
  });

  it('parses "Ends Saturday" as end-of-the-coming-Saturday in Denver', () => {
    // REF is Wednesday Oct 7 — next Saturday is Oct 10
    const result = parseEndDate('Ends Saturday', REF);
    expect(result).not.toBeNull();
    // Should be 3 days after the ref (Sat from Wed = 3 days)
    const diffDays = (result!.getTime() - REF.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeGreaterThan(2);
    expect(diffDays).toBeLessThan(5);
  });

  it('parses "Ends 10/19" as Oct 19 in Denver', () => {
    const result = parseEndDate('Ends 10/19', REF);
    expect(result).not.toBeNull();
    // Should be in October 2026
    expect(result!.getFullYear()).toBe(2026);
    // Roughly 12 days after Oct 7
    const diffDays = (result!.getTime() - REF.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeGreaterThan(10);
    expect(diffDays).toBeLessThan(14);
  });

  it('parses "Ends 10/31" as Oct 31 end-of-day', () => {
    const result = parseEndDate('Ends 10/31', REF);
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2026);
    const diffDays = (result!.getTime() - REF.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeGreaterThan(22);
    expect(diffDays).toBeLessThan(26);
  });

  it('is case-insensitive', () => {
    const lower = parseEndDate('ends today', REF);
    const upper = parseEndDate('ENDS TODAY', REF);
    expect(lower).not.toBeNull();
    expect(upper).not.toBeNull();
    expect(lower!.getTime()).toBe(upper!.getTime());
  });
});

describe('extractDealId', () => {
  it('extracts numeric ID from /deals/3495857/', () => {
    expect(extractDealId('/deals/3495857/')).toBe('3495857');
  });

  it('extracts from full URL', () => {
    expect(extractDealId('https://www.thepromenadeshopsatbriargate.com/deals/3495857/')).toBe('3495857');
  });

  it('returns null for non-deal URL', () => {
    expect(extractDealId('/stores/1035991-aerie/')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractDealId('')).toBeNull();
  });
});

describe('extractBrandKey', () => {
  it('extracts key from /stores/1035991-aerie/', () => {
    expect(extractBrandKey('/stores/1035991-aerie/')).toBe('1035991-aerie');
  });

  it('extracts from full URL', () => {
    expect(extractBrandKey('https://www.thepromenadeshopsatbriargate.com/stores/1036011-lululemon/')).toBe('1036011-lululemon');
  });

  it('returns null for non-store URL', () => {
    expect(extractBrandKey('/deals/3495857/')).toBeNull();
  });
});
