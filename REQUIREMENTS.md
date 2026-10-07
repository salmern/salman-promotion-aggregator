# REQUIREMENTS.md — Traceability Matrix

Maps every FR and NFR to implementation location and evidence.

| ID | Requirement | Implementation | Evidence | Status |
|----|-------------|---------------|---------|--------|
| FR-1 | Scraper retrieves promotions from listing, walks detail pages | `apps/worker/src/scraper/listing.ts`, `detail.ts`, `index.ts` | Real data: 29 promotions from fixture; `.deal-row` selector confirmed | ✅ DONE |
| FR-2 | Scraper enriches promotions with brand data (website, hours, social) | `apps/worker/src/scraper/brand.ts`, `index.ts` | Brand pages fetched per scrape run; hours/website populated | ✅ DONE |
| FR-3 | Persisted in durable MySQL store | `packages/db/src/schema/`, `migrate.ts` | Docker volume `mysql_data`; survives restart | ✅ DONE |
| FR-4 | GET /promotions with search, startDate, endDate, brand, page, pageSize; overlap semantics | `apps/api/src/routes/promotions.ts`, `packages/db/src/repositories/promotionRepository.ts` | Overlap SQL: `startDate <= filterEnd AND endDate >= filterStart`; NULLs treated as open-ended per ASSUMPTIONS.md | ✅ DONE |
| FR-5 | GET /promotions/:id returns single record, 404 when missing | `apps/api/src/routes/promotions.ts` | Returns 404 with structured error for unknown ID | ✅ DONE |
| FR-6 | GET /brands returns name + promotionCount + metadata | `apps/api/src/routes/brands.ts` | Returns `{ items: BrandWithCount[] }` with hours, websiteUrl, socialLinks | ✅ DONE |
| FR-7 | POST /scrape enqueues BullMQ job, returns jobId immediately | `apps/api/src/routes/scrape.ts` | Returns 202 with `{ jobId }` without waiting for scrape | ✅ DONE |
| FR-8 | GET /scrape/:jobId returns state + counts | `apps/api/src/routes/scrape.ts` | Returns `{ state, counts: { attempted, persisted, updated, skipped, failed } }` | ✅ DONE |
| FR-9 | Queue: retries, backoff, timeout, failure logging; failed job doesn't crash API | `apps/worker/src/workers/scrapeWorker.ts` | attempts: 3, exponential backoff 5s, lockDuration 300s; per-promotion try/catch increments failed count | ✅ DONE |
| FR-10 | POST /verify enqueues verification job | `apps/api/src/routes/verify.ts` | Creates DB run record first, then enqueues; returns runId immediately | ✅ DONE |
| FR-11 | GET /verify/:runId returns discrepancy report | `apps/api/src/routes/verify.ts` | Reports gone/changed/unverifiable; clean run returns `{ result: "clean", discrepancies: [] }` | ✅ DONE |
| FR-12 | UI lists promotions with search, filter, pagination | `apps/web/src/app/page.tsx`, `Filters.tsx`, `Pagination.tsx` | Search, date range, brand filter, page-number pagination | ✅ DONE |
| FR-13 | UI group-by-brand view with brand metadata | `apps/web/src/components/BrandSection.tsx` | Toggle switches layout; brand header shows name, hours, website | ✅ DONE |
| FR-14 | Types shared end-to-end; avoid any | `packages/shared/src/types.ts` | `tsc --strict` passes with zero errors across all packages | ✅ DONE |
| FR-15 | POST /scrape/:jobId/cancel stops running job | `apps/api/src/routes/scrape.ts`, Redis flag in worker | Sets `cancel:{jobId}` Redis key; worker polls after each promotion; GET shows `cancelled` | ✅ DONE |
| FR-16 | Drift demo: mutate persisted data, verify catches all changes | `scripts/demo-drift.ts` | 3 mutations (endDate, hours, ghost record); verification report catches all 3 | ✅ DONE |
| NFR-1 | Clone + docker compose up → running app | `docker-compose.yml`, `README.md` | Health-checked startup ordering; migrations run automatically | ✅ DONE |
| NFR-2 | Polite scraping (delay, concurrency cap, UA) | `apps/worker/src/scraper/browser.ts` | 1.5s delay, max 2 concurrent, Chrome UA; documented in DESIGN.md | ✅ DONE |
| NFR-3 | API requests < 5s; scrape/verify return immediately | All routes | Scrape/verify POST returns in < 200ms; list queries use indexed columns | ✅ DONE |
| NFR-4 | No secrets in repo; .env.example pattern | `.env.example`, `.gitignore` | `.env` in gitignore; no credentials in source | ✅ DONE |
| NFR-5 | Errors logged, not swallowed; show in run counts | Worker error handling | Failed promotions increment `failed` count; pino structured logging | ✅ DONE |
| NFR-6 | docker compose up brings up API + worker + frontend + MySQL + Redis | `docker-compose.yml` | 5 services with health checks and startup dependencies | ✅ DONE |
| NFR-7 | Tests cover listing/detail/brand parsers + verification diff; run against HTML fixtures | `apps/worker/src/tests/` | 64 tests pass, zero network calls | ✅ DONE |
| NFR-8 | Committed HTML snapshots: listing, detail, brand | `tests/fixtures/*.html` | 3 files committed: listing.html (108KB), detail.html (98KB), brand.html (107KB) | ✅ DONE |

---

## Status Legend
- ✅ DONE — implemented and verified
- ⚠️ PARTIAL — implemented but not fully verified
- 🔄 IN PROGRESS — being implemented
- 🔲 TODO — not yet implemented
