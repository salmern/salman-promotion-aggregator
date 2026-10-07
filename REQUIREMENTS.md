# REQUIREMENTS.md — Traceability Matrix

Maps every FR and NFR to implementation location, evidence, and status.

| ID | Requirement | Implementation | Evidence | Status |
|----|-------------|---------------|---------|--------|
| FR-1 | Scraper retrieves promotion records from listing page, walking into detail pages | `apps/worker/src/scraper/listing.ts`, `apps/worker/src/scraper/detail.ts` | Scrape job populates `promotions` table with real data | 🔲 TODO |
| FR-2 | Scraper enriches promotions with brand-level data (website, hours, social) | `apps/worker/src/scraper/brand.ts` | `brands` table contains non-null websiteUrl, hours, socialLinks for brands that have them | 🔲 TODO |
| FR-3 | Persisted in durable store (MySQL) | `apps/api/src/db/schema.ts`, Drizzle migrations | Data survives process restart; docker volume mount | 🔲 TODO |
| FR-4 | GET /promotions with search, startDate, endDate, brand, page, pageSize; overlap semantics | `apps/api/src/routes/promotions.ts` | API tests cover overlap, missing dates, pagination | 🔲 TODO |
| FR-5 | GET /promotions/:id returns single record, 404 when missing | `apps/api/src/routes/promotions.ts` | API test: known ID returns 200, unknown returns 404 | 🔲 TODO |
| FR-6 | GET /brands returns name + promotionCount + metadata | `apps/api/src/routes/brands.ts` | Returns structured brand objects | 🔲 TODO |
| FR-7 | POST /scrape enqueues BullMQ job, returns jobId immediately | `apps/api/src/routes/scrape.ts`, `apps/worker/src/workers/scrapeWorker.ts` | Response time < 200ms; job visible in BullMQ | 🔲 TODO |
| FR-8 | GET /scrape/:jobId returns state + counts | `apps/api/src/routes/scrape.ts` | Returns { state, attempted, persisted, updated, skipped, failed } | 🔲 TODO |
| FR-9 | Queue: retries, backoff, timeout, failure logging; failed job doesn't crash API | `apps/worker/src/workers/scrapeWorker.ts` queue config | Worker failure tested; API continues serving requests | 🔲 TODO |
| FR-10 | POST /verify enqueues verification job | `apps/api/src/routes/verify.ts`, `apps/worker/src/workers/verifyWorker.ts` | Returns runId immediately | 🔲 TODO |
| FR-11 | GET /verify/:runId returns discrepancy report | `apps/api/src/routes/verify.ts` | Reports gone, changed fields, unverifiable; clean run returns explicit clean result | 🔲 TODO |
| FR-12 | UI lists promotions with search, filter, pagination | `apps/web/src/app/page.tsx` | Functional search + date/brand filter + page controls | 🔲 TODO |
| FR-13 | UI group-by-brand view with brand metadata | `apps/web/src/components/BrandGroupView.tsx` | Toggle switches to grouped layout with brand header | 🔲 TODO |
| FR-14 | Types shared end-to-end; avoid any | `packages/shared/src/types.ts` | No `any` in codebase (tsc --strict passes) | 🔲 TODO |
| FR-15 | POST /scrape/:jobId/cancel stops running job | `apps/api/src/routes/scrape.ts`, Redis cancellation flag in worker | Worker stops loop; GET shows cancelled; counts reflect work done | 🔲 TODO |
| FR-16 | Drift demo: mutate persisted data, verify catches all changes | `scripts/demo-drift.ts` | `npm run demo:drift` + POST /verify catches end date change, hours change, fake promotion | 🔲 TODO |
| NFR-1 | Clone + docker compose up → running app | `docker-compose.yml`, `README.md` | Verified on clean state | 🔲 TODO |
| NFR-2 | Polite scraping (delay, concurrency cap, UA) | `apps/worker/src/scraper/browser.ts` | 1.5s delay, max 2 concurrent, documented in DESIGN.md | 🔲 TODO |
| NFR-3 | API requests < 5s; scrape/verify return immediately | Fastify route handlers | Scrape/verify return in < 200ms; list/brands < 5s | 🔲 TODO |
| NFR-4 | No secrets in repo; .env.example pattern | `.env.example`, `.gitignore` | No credentials committed | 🔲 TODO |
| NFR-5 | Errors logged, not swallowed; show in run counts | Worker error handling | Failed promotions increment failed count, logged | 🔲 TODO |
| NFR-6 | docker compose up brings up API + worker + frontend + MySQL + Redis | `docker-compose.yml` | All 5 services start and communicate | 🔲 TODO |
| NFR-7 | Tests cover listing/detail/brand parsers + verification diff; run against HTML fixtures | `apps/worker/src/tests/` | `npm test` passes without network access | 🔲 TODO |
| NFR-8 | Committed HTML snapshots: listing page, detail page, brand page | `tests/fixtures/` | 3 HTML files committed | 🔲 TODO |

---

## Status Legend
- 🔲 TODO — not yet implemented
- 🔄 IN PROGRESS — being implemented
- ✅ DONE — implemented and verified
- ⚠️ PARTIAL — implemented but not fully verified

_This file is updated at the end of each implementation phase._
