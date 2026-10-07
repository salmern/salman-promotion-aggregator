# DESIGN.md — Promotions Aggregator (Single-Mall MVP)

_Written before implementation. Updated as decisions are finalized._

---

## 1. Scraping Strategy

### Target
`https://www.thepromenadeshopsatbriargate.com/sales`

### Why Playwright

Initial investigation confirmed the site is **fully client-side rendered**. A plain `fetch()` or `got` request returns only stripped text content — no anchor tags, no image URLs, no deal IDs. The actual DOM (including promotion cards, deal links, brand page links, website URLs, and social media icons) is injected by JavaScript after page load.

Playwright (headless Chromium) was chosen because:
- It executes JavaScript and waits for the DOM to settle before extraction.
- It handles redirects, cookies, and browser fingerprinting natively.
- It provides `page.evaluate()` for in-page DOM queries using browser-native APIs.
- It is significantly more reliable for this class of site than HTTP + cheerio alone.

Cheerio is still used for **parsing committed HTML fixtures in tests** where full browser execution is not needed.

### Scraping Flow

```
1. Open /sales → collect all promotion cards
   → for each card: { dealId, name, brand name, endDate text, imageUrl, dealUrl }

2. For each promotion deal URL (/deals/{id}/):
   → fetch detail page → { description, imageUrl (high-res), startDate, endDate, brandPageUrl }

3. For each unique brand page URL (/stores/{id}-{slug}/):
   → fetch store page → { websiteUrl, hours, socialLinks, address }

4. Normalize & persist via upsert (deduplicate by dealId)
```

Steps 2 and 3 are parallelized with a concurrency cap of **2 pages at once** and a **1.5 second delay** between requests (see Politeness section).

### Stable Identifier

Each promotion URL is `/deals/{numericId}/`. The numeric deal ID is the **stable source identifier** — it is source-assigned, durable across re-scrapes, and unique per promotion. It is stored as `source_id` and used for upsert deduplication.

If a deal ID is somehow unavailable (malformed URL), we fall back to a deterministic SHA-256 hash of `normalize(title + brandName)`.

This decision is documented here because the brief explicitly asks for it.

---

## 2. Schema Design

### Brand Normalization

Brands are stored in a **separate `brands` table**, not duplicated on each promotion row.

Trade-off considered:
- **Denormalized** (embed brand fields on every promotion): simpler queries, no JOIN needed. But hours, website, and social links would be duplicated across every promotion for that brand. An update to brand hours would require updating N rows.
- **Normalized** (separate `brands` table): one row per brand, promotions reference it via `brand_id`. Single source of truth for brand metadata. Marginally more complex queries.

Decision: **normalized**. The brand metadata (hours, website, socials) is logically a property of the brand, not the promotion. It belongs in one place.

### Key Tables

**`brands`** — one row per brand, keyed by `source_brand_key` (the slug from the store URL, e.g. `1035991-aerie`).

**`promotions`** — one row per deal, keyed by `source_id` (numeric deal ID from URL). Foreign key to `brands`.

**`verification_runs`** — one row per verification job execution.

**`verification_discrepancies`** — one row per detected change within a run.

### Missing Data Strategy

Consistent across the entire codebase:
- **Nullable scalar fields** (`string | null`, `Date | null`) for optional single values: `websiteUrl`, `startDate`, `endDate`, `description`, `imageUrl`.
- **Empty arrays** (`[]`) for optional collections: `socialLinks`, `hours` entries.
- **Never `undefined`** in API responses — always explicitly `null` or `[]`.

This makes the API contract predictable: consumers never need to `?.` guard against missing keys, only null-check values.

### Date / Timezone Handling

All promotion dates are treated as **America/Denver (Mountain Time)** per the brief.

- **Storage**: UTC timestamp in MySQL (`DATETIME` column). Denver-local dates are converted to UTC before insert.
- **API serialization**: ISO 8601 strings in UTC (`2026-10-15T06:00:00.000Z`), with a `timezone: "America/Denver"` field in the response envelope so consumers know the logical timezone.
- **Frontend display**: Dates are formatted in `America/Denver` locale using `Intl.DateTimeFormat` with `timeZone: 'America/Denver'`.
- **Parsing**: Date strings from the source (e.g. "Ends 10/19", "Ends Today", "Ends Tomorrow") are normalized against the scrape timestamp in Denver local time.

---

## 3. Queue Architecture

```
POST /scrape
    |
    | add job to Redis
    v
BullMQ Queue ("scrape")
    |
    v
BullMQ Worker (apps/worker)
    |-- reads job data
    |-- runs Playwright scraper
    |-- writes progress counts to job.updateData()
    |-- polls Redis cancellation key
    |-- persists to MySQL
    v
MySQL
```

The API process and the worker process are **separate Node.js processes** (separate Docker services). The API only enqueues jobs and reads job state. The worker only consumes jobs. This separation ensures a hung scrape never blocks the API.

### Retry & Backoff

BullMQ job options:
- `attempts: 3`
- `backoff: { type: 'exponential', delay: 5000 }` (5s → 10s → 20s)
- `timeout: 300000` (5 minutes per job)

Individual promotion failures inside a job do NOT fail the whole job — they increment `failed` count and continue.

### Cancellation Design

BullMQ does not support interrupting an already-executing job from outside. The approach used here:

1. `POST /scrape/:jobId/cancel` sets a Redis key `cancel:{jobId} = "1"` with a 10-minute TTL.
2. The worker **polls this key every N promotions** (configurable, default: after each promotion).
3. When the key is detected, the worker stops the loop, clears the key, and throws a named `CancellationError`.
4. BullMQ catches the thrown error and marks the job `failed` with reason `"Cancelled by user"`.
5. `GET /scrape/:jobId` returns `state: "cancelled"` when `failedReason` contains the cancellation marker.

Records already persisted before cancellation remain in the database — this is the correct behaviour (partial data is better than no data).

---

## 4. Verification Strategy

The verifier re-scrapes a **sample of persisted promotions** — specifically all promotions whose `source_id` is still valid (i.e. not known to be expired). It does not blindly re-scrape the entire site; it checks whether each known deal URL still returns matching data.

Trade-off:
- **Full re-scrape**: most thorough, catches new promotions added since last run. But expensive.
- **Targeted re-check**: visits only already-known deal URLs. Cheaper, sufficient for drift detection.

Decision: **targeted re-check**. The verifier's job is to confirm existing data is still accurate, not to discover new promotions. New promotions are found by the scraper.

### Discrepancy Definition

A discrepancy is reported when:
1. **Gone**: a deal URL returns 404/410/redirect-away — the promotion no longer exists at source.
2. **Field changed**: a scraped field differs from the stored value after normalization.
3. **Unverifiable**: the page failed to load (network error, timeout) — reported with reason.

**Not** reported as discrepancies:
- Image CDN URL query-string churn (we compare only the URL path, not the full CDN URL with cache params).
- Whitespace-only differences.
- Case differences in brand name (normalized to lowercase for comparison).
- Dates that differ by less than 1 hour (to absorb timezone edge cases in parsing).

---

## 5. Failure Handling

- Scraper errors at the individual promotion level: caught, logged with `promotionId` and error message, `failed` count incremented, loop continues.
- Worker-level unrecoverable errors: BullMQ retries up to 3 times with backoff, then marks job `failed` — API stays up.
- API validation errors: Zod schema validation on all inputs, returns structured 422 with field-level errors.
- Database errors: wrapped in try/catch, logged, return 500 with non-leaking message.
- Playwright errors: wrapped, browser closed in `finally` block, never leak open browser processes.

---

## 6. What Was Intentionally Cut

- **Multi-portal abstraction**: single portal hard-coded by design.
- **Automated scheduling (cron)**: endpoints for on-demand triggering only.
- **Real-time job progress via WebSocket**: client polls `GET /scrape/:jobId`.
- **Authentication**: API is open locally.
- **Full re-scrape on verification**: targeted re-check only.
- **Pagination on verification discrepancies**: all discrepancies returned in one report (expected to be small).
