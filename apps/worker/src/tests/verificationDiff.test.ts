/**
 * Verification diff tests.
 * Deterministic unit tests — no fixtures, no network, no DB.
 *
 * Verifies:
 *  - Unchanged record produces no discrepancies
 *  - Changed field produces exactly one discrepancy with correct before/after
 *  - Multiple changed fields produce multiple discrepancies
 *  - Image CDN URL churn is NOT reported (path-only comparison)
 *  - Whitespace differences are NOT reported
 *  - Dates within 1 hour of each other are NOT reported (timezone tolerance)
 *  - Dates differing by >1 hour ARE reported
 *  - Gone promotion (null name) is handled separately by verifier (not diff)
 */
import { describe, it, expect } from 'vitest';
import { diffPromotion } from '../verifier/diff';
import type { PromotionSnapshot } from '../verifier/diff';

function makeSnapshot(overrides: Partial<PromotionSnapshot> = {}): PromotionSnapshot {
  return {
    name: 'Test Promotion',
    description: 'Buy 2 get 1 free on all candles.',
    imageUrl: 'https://cdn-files.eu.placewise.com/f/some-image-path',
    endDate: new Date('2026-10-20T06:00:00.000Z'),
    startDate: null,
    ...overrides,
  };
}

describe('diffPromotion', () => {
  describe('no changes', () => {
    it('returns empty array when stored equals fresh', () => {
      const snap = makeSnapshot();
      expect(diffPromotion(snap, snap)).toEqual([]);
    });

    it('ignores whitespace-only differences in description', () => {
      const stored = makeSnapshot({ description: 'Buy 2 get 1 free  on all  candles.' });
      const fresh = makeSnapshot({ description: 'Buy 2 get 1 free on all candles.' });
      expect(diffPromotion(stored, fresh)).toEqual([]);
    });

    it('ignores case differences in name', () => {
      const stored = makeSnapshot({ name: 'Summer Sale' });
      const fresh = makeSnapshot({ name: 'summer sale' });
      expect(diffPromotion(stored, fresh)).toEqual([]);
    });

    it('ignores CDN URL query string churn (same path)', () => {
      const stored = makeSnapshot({
        imageUrl: 'https://cdn.example.com/images/deal-123?v=1&token=abc',
      });
      const fresh = makeSnapshot({
        imageUrl: 'https://cdn.example.com/images/deal-123?v=2&token=xyz',
      });
      expect(diffPromotion(stored, fresh)).toEqual([]);
    });

    it('treats dates within 1 hour as equivalent', () => {
      const stored = makeSnapshot({ endDate: new Date('2026-10-20T06:00:00.000Z') });
      const fresh = makeSnapshot({ endDate: new Date('2026-10-20T06:30:00.000Z') });
      expect(diffPromotion(stored, fresh)).toEqual([]);
    });

    it('treats both null dates as equal', () => {
      const snap = makeSnapshot({ endDate: null, startDate: null });
      expect(diffPromotion(snap, snap)).toEqual([]);
    });
  });

  describe('field changes', () => {
    it('detects name change', () => {
      const stored = makeSnapshot({ name: 'Summer Sale' });
      const fresh = makeSnapshot({ name: 'End of Season Sale' });
      const diffs = diffPromotion(stored, fresh);
      expect(diffs).toHaveLength(1);
      expect(diffs[0]?.field).toBe('name');
      expect(diffs[0]?.before).toBe('Summer Sale');
      expect(diffs[0]?.after).toBe('End of Season Sale');
    });

    it('detects description change', () => {
      const stored = makeSnapshot({ description: 'Save 20% storewide.' });
      const fresh = makeSnapshot({ description: 'Save 30% storewide.' });
      const diffs = diffPromotion(stored, fresh);
      expect(diffs).toHaveLength(1);
      expect(diffs[0]?.field).toBe('description');
    });

    it('detects endDate change beyond 1-hour tolerance', () => {
      const stored = makeSnapshot({ endDate: new Date('2026-10-20T06:00:00.000Z') });
      const fresh = makeSnapshot({ endDate: new Date('2026-10-15T06:00:00.000Z') }); // 5 days different
      const diffs = diffPromotion(stored, fresh);
      expect(diffs).toHaveLength(1);
      expect(diffs[0]?.field).toBe('endDate');
    });

    it('detects endDate going from value to null', () => {
      const stored = makeSnapshot({ endDate: new Date('2026-10-20T06:00:00.000Z') });
      const fresh = makeSnapshot({ endDate: null });
      const diffs = diffPromotion(stored, fresh);
      expect(diffs).toHaveLength(1);
      expect(diffs[0]?.field).toBe('endDate');
      expect(diffs[0]?.before).toContain('2026-10-20');
      expect(diffs[0]?.after).toBe('null');
    });

    it('detects image path change (different path, not just query string)', () => {
      const stored = makeSnapshot({
        imageUrl: 'https://cdn.example.com/images/old-deal-123',
      });
      const fresh = makeSnapshot({
        imageUrl: 'https://cdn.example.com/images/new-deal-456',
      });
      const diffs = diffPromotion(stored, fresh);
      expect(diffs).toHaveLength(1);
      expect(diffs[0]?.field).toBe('imageUrl');
    });

    it('reports multiple changed fields', () => {
      const stored = makeSnapshot({
        name: 'Old Name',
        endDate: new Date('2026-10-20T06:00:00.000Z'),
      });
      const fresh = makeSnapshot({
        name: 'New Name',
        endDate: new Date('2026-10-15T06:00:00.000Z'),
      });
      const diffs = diffPromotion(stored, fresh);
      expect(diffs.length).toBeGreaterThanOrEqual(2);
      const fields = diffs.map((d) => d.field);
      expect(fields).toContain('name');
      expect(fields).toContain('endDate');
    });
  });

  describe('null handling', () => {
    it('does not report description change when both are null', () => {
      const snap = makeSnapshot({ description: null });
      expect(diffPromotion(snap, snap)).toEqual([]);
    });

    it('detects description appearing from null', () => {
      const stored = makeSnapshot({ description: null });
      const fresh = makeSnapshot({ description: 'New description added' });
      const diffs = diffPromotion(stored, fresh);
      expect(diffs).toHaveLength(1);
      expect(diffs[0]?.field).toBe('description');
    });

    it('does not report image change when both are null', () => {
      const snap = makeSnapshot({ imageUrl: null });
      expect(diffPromotion(snap, snap)).toEqual([]);
    });
  });
});
