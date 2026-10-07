/**
 * Verification diff engine.
 *
 * Compares a stored promotion against freshly scraped data and
 * returns a list of meaningful field changes.
 *
 * Non-discrepancies (per DESIGN.md):
 *  - Whitespace-only differences
 *  - Image CDN URL query-string / parameter churn (path compared only)
 *  - Case differences in brand name (normalized to lowercase)
 *  - Date differences under 1 hour (timezone parse edge cases)
 */

export interface FieldDiff {
  field: string;
  before: string;
  after: string;
}

export interface PromotionSnapshot {
  name: string;
  description: string | null;
  imageUrl: string | null;
  endDate: Date | null;
  startDate: Date | null;
}

/**
 * Compare stored vs. freshly scraped promotion data.
 * Returns an array of meaningful field differences.
 * Empty array = no drift.
 */
export function diffPromotion(
  stored: PromotionSnapshot,
  fresh: PromotionSnapshot,
): FieldDiff[] {
  const diffs: FieldDiff[] = [];

  // Name
  if (normalizeText(stored.name) !== normalizeText(fresh.name)) {
    diffs.push({ field: 'name', before: stored.name, after: fresh.name });
  }

  // Description
  if (normalizeText(stored.description ?? '') !== normalizeText(fresh.description ?? '')) {
    diffs.push({
      field: 'description',
      before: stored.description ?? '',
      after: fresh.description ?? '',
    });
  }

  // Image URL — compare path only, ignore CDN query strings
  const storedImagePath = imagePathOnly(stored.imageUrl);
  const freshImagePath = imagePathOnly(fresh.imageUrl);
  if (storedImagePath !== freshImagePath) {
    diffs.push({
      field: 'imageUrl',
      before: stored.imageUrl ?? '',
      after: fresh.imageUrl ?? '',
    });
  }

  // End date — ignore sub-hour differences
  if (!datesAreEquivalent(stored.endDate, fresh.endDate)) {
    diffs.push({
      field: 'endDate',
      before: stored.endDate?.toISOString() ?? 'null',
      after: fresh.endDate?.toISOString() ?? 'null',
    });
  }

  // Start date
  if (!datesAreEquivalent(stored.startDate, fresh.startDate)) {
    diffs.push({
      field: 'startDate',
      before: stored.startDate?.toISOString() ?? 'null',
      after: fresh.startDate?.toISOString() ?? 'null',
    });
  }

  return diffs;
}

function normalizeText(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

function imagePathOnly(url: string | null): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    return u.hostname + u.pathname;
  } catch {
    return url;
  }
}

function datesAreEquivalent(a: Date | null, b: Date | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return Math.abs(a.getTime() - b.getTime()) < 60 * 60 * 1000; // 1 hour tolerance
}
