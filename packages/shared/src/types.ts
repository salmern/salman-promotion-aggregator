/**
 * Shared domain types flowing scraper → worker → API → frontend.
 * No `any` — all fields are explicitly typed.
 */

// ─── Social Links ────────────────────────────────────────────────────────────

export type SocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'twitter'
  | 'youtube'
  | 'pinterest'
  | 'other';

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
}

// ─── Hours ───────────────────────────────────────────────────────────────────

export interface HoursEntry {
  days: string;   // e.g. "Mon – Sat"
  open: string;   // e.g. "10am"
  close: string;  // e.g. "8pm"
}

// ─── Brand ───────────────────────────────────────────────────────────────────

export interface Brand {
  id: number;
  sourceBrandKey: string;      // slug from store URL e.g. "1035991-aerie"
  name: string;
  websiteUrl: string | null;
  hours: HoursEntry[];
  hoursRaw: string | null;     // raw text fallback if parsing fails
  socialLinks: SocialLink[];
  sourceUrl: string | null;    // mall store page URL
  scrapedAt: string;           // ISO 8601 UTC
  createdAt: string;
  updatedAt: string;
}

export interface BrandWithCount extends Brand {
  promotionCount: number;
}

// ─── Verification Status ─────────────────────────────────────────────────────

export type VerificationStatus = 'pending' | 'verified' | 'changed' | 'gone' | 'unverifiable';

// ─── Promotion ───────────────────────────────────────────────────────────────

export interface Promotion {
  id: number;
  sourceId: string;            // numeric deal ID from /deals/{id}/
  brandId: number;
  brand: Brand;
  name: string;
  description: string | null;
  imageUrl: string | null;
  startDate: string | null;    // ISO 8601 UTC
  endDate: string | null;      // ISO 8601 UTC
  canonicalUrl: string;
  sourcePortal: string;
  scrapedAt: string;           // ISO 8601 UTC
  lastVerifiedAt: string | null;
  verificationStatus: VerificationStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Scraper Output (internal, not exposed directly in API) ──────────────────

export interface ScrapedBrand {
  sourceBrandKey: string;
  name: string;
  websiteUrl: string | null;
  hours: HoursEntry[];
  hoursRaw: string | null;
  socialLinks: SocialLink[];
  sourceUrl: string | null;
}

export interface ScrapedPromotion {
  sourceId: string;
  brandKey: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  startDate: Date | null;
  endDate: Date | null;
  canonicalUrl: string;
  sourcePortal: string;
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
  meta: {
    timezone: 'America/Denver';
  };
}

// ─── Promotion Filters ───────────────────────────────────────────────────────

export interface PromotionFilters {
  search?: string;
  startDate?: string;   // ISO date string YYYY-MM-DD
  endDate?: string;     // ISO date string YYYY-MM-DD
  brand?: string;
  page?: number;
  pageSize?: number;
}

// ─── Scrape Job ──────────────────────────────────────────────────────────────

export type JobState = 'waiting' | 'active' | 'completed' | 'failed' | 'cancelled' | 'delayed';

export interface ScrapeJobCounts {
  attempted: number;
  persisted: number;
  updated: number;
  skipped: number;
  failed: number;
}

export interface ScrapeJobStatus {
  jobId: string;
  state: JobState;
  counts: ScrapeJobCounts;
  failedReason: string | null;
  createdAt: string | null;
  processedAt: string | null;
  finishedAt: string | null;
}

export interface EnqueueScrapeResponse {
  jobId: string;
  message: string;
}

// ─── Verification ────────────────────────────────────────────────────────────

export type VerificationRunStatus = 'running' | 'completed' | 'failed';

export type DiscrepancyType = 'gone' | 'changed' | 'unverifiable';

export interface VerificationDiscrepancy {
  id: number;
  runId: number;
  promotionId: number | null;
  brandId: number | null;
  promotionName: string | null;
  discrepancyType: DiscrepancyType;
  fieldName: string | null;
  beforeValue: string | null;
  afterValue: string | null;
  reason: string | null;
  createdAt: string;
}

export interface VerificationReport {
  runId: number;
  status: VerificationRunStatus;
  startedAt: string;
  completedAt: string | null;
  checkedCount: number;
  discrepancyCount: number;
  failedCount: number;
  result: 'clean' | 'drift' | 'partial' | 'running';
  discrepancies: VerificationDiscrepancy[];
  error: string | null;
}

// ─── API Error ───────────────────────────────────────────────────────────────

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}

// ─── Job Data (passed through BullMQ) ────────────────────────────────────────

export interface ScrapeJobData {
  triggeredAt: string;
  sourcePortal: string;
}

export interface VerifyJobData {
  triggeredAt: string;
  runId: number;
}
