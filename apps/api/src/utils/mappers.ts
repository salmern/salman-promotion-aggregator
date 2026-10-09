/**
 * Maps raw DB rows to typed API response objects.
 * All dates serialized as ISO 8601 UTC strings.
 */
import type {
  Brand,
  BrandWithCount,
  Promotion,
  VerificationReport,
  VerificationDiscrepancy,
  VerificationRunStatus,
  DiscrepancyType,
  VerificationStatus,
  JobState,
  ScrapeJobStatus,
  ScrapeJobCounts,
} from '@promotions/shared';
import type { BrandRow } from '@promotions/db';
import type { VerificationRunRow, VerificationDiscrepancyRow } from '@promotions/db';
import type { PromotionWithBrand } from '@promotions/db';
import type { BrandWithCount as DbBrandWithCount } from '@promotions/db';
import type { Job } from 'bullmq';
import type { HoursEntry, SocialLink } from '@promotions/shared';

export function mapBrand(row: BrandRow): Brand {
  return {
    id: row.id,
    sourceBrandKey: row.sourceBrandKey,
    name: row.name,
    websiteUrl: row.websiteUrl ?? null,
    hours: (row.hours as HoursEntry[]) ?? [],
    hoursRaw: row.hoursRaw ?? null,
    socialLinks: (row.socialLinks as SocialLink[]) ?? [],
    sourceUrl: row.sourceUrl ?? null,
    scrapedAt: row.scrapedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapBrandWithCount(row: DbBrandWithCount): BrandWithCount {
  return {
    ...mapBrand(row),
    promotionCount: row.promotionCount,
  };
}

export function mapPromotion(row: PromotionWithBrand): Promotion {
  return {
    id: row.id,
    sourceId: row.sourceId,
    brandId: row.brandId,
    brand: mapBrand(row.brand),
    name: row.name,
    description: row.description ?? null,
    imageUrl: row.imageUrl ?? null,
    startDate: row.startDate?.toISOString() ?? null,
    endDate: row.endDate?.toISOString() ?? null,
    canonicalUrl: row.canonicalUrl,
    sourcePortal: row.sourcePortal,
    scrapedAt: row.scrapedAt.toISOString(),
    lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
    verificationStatus: row.verificationStatus as VerificationStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapVerificationDiscrepancy(
  row: VerificationDiscrepancyRow,
): VerificationDiscrepancy {
  return {
    id: row.id,
    runId: row.runId,
    promotionId: row.promotionId ?? null,
    brandId: row.brandId ?? null,
    promotionName: row.promotionName ?? null,
    discrepancyType: row.discrepancyType as DiscrepancyType,
    fieldName: row.fieldName ?? null,
    beforeValue: row.beforeValue ?? null,
    afterValue: row.afterValue ?? null,
    reason: row.reason ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapVerificationReport(
  run: VerificationRunRow,
  discrepancies: VerificationDiscrepancyRow[],
): VerificationReport {
  const result =
    run.status === 'running'
      ? 'running'
      : run.discrepancyCount > 0
        ? 'drift'
        : run.failedCount > 0
          ? 'partial'
          : 'clean';

  return {
    runId: run.id,
    status: run.status as VerificationRunStatus,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    checkedCount: run.checkedCount,
    discrepancyCount: run.discrepancyCount,
    failedCount: run.failedCount,
    result,
    discrepancies: discrepancies.map(mapVerificationDiscrepancy),
    error: run.error ?? null,
  };
}

/**
 * Maps a BullMQ Job to a typed ScrapeJobStatus.
 * The job's data field stores progress counts written by updateData().
 *
 * Cancellation detection:
 *  - Normal path: worker throws Error('CANCELLED: ...') → BullMQ marks 'failed'
 *    → isCancelled detected by state==='failed' + failedReason starts with 'CANCELLED:'
 *  - Race condition: scrape finishes before cancel flag is polled → BullMQ marks
 *    'completed' but job.data.status === 'cancelled' (set by worker before returning)
 *    → detected via data.status field
 *  - Waiting job cancelled: moveToFailed with CANCELLED reason → state='failed'
 *    → detected by normal path above
 */
export async function mapJobStatus(job: Job): Promise<ScrapeJobStatus> {
  const state = await job.getState();
  const data = job.data as Record<string, unknown>;

  const counts: ScrapeJobCounts = {
    attempted: (data['attempted'] as number | undefined) ?? 0,
    persisted: (data['persisted'] as number | undefined) ?? 0,
    updated: (data['updated'] as number | undefined) ?? 0,
    skipped: (data['skipped'] as number | undefined) ?? 0,
    failed: (data['failed'] as number | undefined) ?? 0,
  };

  // Detect cancellation — three paths:
  // 1. Job failed with CANCELLED reason (normal cancellation path via throw)
  const cancelledViaFailed =
    state === 'failed' &&
    typeof job.failedReason === 'string' &&
    job.failedReason.startsWith('CANCELLED:');

  // 2. Job completed/failed but worker set data.status='cancelled'
  const cancelledViaData =
    (state === 'completed' || state === 'failed') &&
    (data['status'] as string | undefined) === 'cancelled';

  // 3. Job completed but failedReason still contains CANCELLED: marker
  //    (race condition: BullMQ can attach failedReason to completed jobs)
  const cancelledViaCompletedReason =
    state === 'completed' &&
    typeof job.failedReason === 'string' &&
    job.failedReason.startsWith('CANCELLED:');

  const isCancelled = cancelledViaFailed || cancelledViaData || cancelledViaCompletedReason;

  const mappedState: JobState = isCancelled ? 'cancelled' : (state as JobState);

  const failedReason = isCancelled
    ? (job.failedReason?.replace(/^CANCELLED:\s*/, '') ?? 'Cancelled by user')
    : (job.failedReason ?? null);

  return {
    jobId: job.id ?? '',
    state: mappedState,
    counts,
    failedReason,
    createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
    processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
    finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
  };
}
