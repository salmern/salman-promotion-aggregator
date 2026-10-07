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

  // Detect cancellation from failed reason
  const isCancelled =
    state === 'failed' &&
    typeof job.failedReason === 'string' &&
    job.failedReason.startsWith('CANCELLED:');

  const mappedState: JobState = isCancelled ? 'cancelled' : (state as JobState);

  return {
    jobId: job.id ?? '',
    state: mappedState,
    counts,
    failedReason: isCancelled
      ? job.failedReason?.replace(/^CANCELLED:\s*/, '') ?? null
      : (job.failedReason ?? null),
    createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
    processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
    finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
  };
}
