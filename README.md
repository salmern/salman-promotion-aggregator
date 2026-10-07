# Promotions Aggregator — Single-Mall MVP

A production-quality pipeline that scrapes promotions from **The Promenade Shops at Briargate** (Colorado Springs), persists them in MySQL, re-verifies them against the live source, and exposes them through a typed REST API and a polished Next.js UI.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Compose Stack                      │
│                                                             │
│  ┌──────────┐   ┌─────────────┐   ┌──────────────────────┐ │
│  │  Next.js │   │   Fastify   │   │   BullMQ Worker      │ │
│  │  web:3001│──▶│   api:3000  │   │  (scraper+verifier)  │ │
│  └──────────┘   └──────┬──────┘   └──────────┬───────────┘ │
│                        │ enqueue               │ consume     │
│                        ▼                       ▼             │
│                  ┌─────────┐          ┌────────────────┐    │
│                  │  Redis  │◀─────────│  BullMQ Queue  │    │
│                  └─────────┘          └────────────────┘    │
│                        │                       │             │
│                        └──────────┬────────────┘            │
│                                   ▼                          │
│                             ┌──────────┐                    │
│                             │  MySQL   │                     │
│                             └──────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

**Monorepo structure:**

```
salman-promotion-aggregator/
├── packages/
│   ├── shared/      # Shared TypeScript types (scraper → API → UI)
│   └── db/          # Drizzle ORM schema, migrations, repositories
├── apps/
│   ├── api/         # Fastify REST API + job queue producer
│   ├── worker/      # BullMQ consumer (Playwright scraper + verifier)
│   └── web/         # Next.js frontend
├── scripts/
│   └── demo-drift.ts  # FR-16 drift simulation
└── tests/
    └── fixtures/    # Committed HTML snapshots for parser tests
```

---

## Prerequisites

- **Docker** ≥ 24 and **Docker Compose** ≥ 2
- That's it — MySQL, Redis, Node, and Chromium all run inside containers

For running scripts or tests locally:
- **Node.js** ≥ 20
- **npm** ≥ 10

---

## Quick Start

### 1. Clone and configure

```bash
git clone <your-repo-url> salman-promotion-aggregator
cd salman-promotion-aggregator
cp .env.example .env
```

The defaults in `.env` work out of the box. Only change them if you have port conflicts.

### 2. Start the stack

```bash
docker compose up --build
```

This starts five services in order (with health-check dependencies):
- **MySQL** — waits until healthy
- **Redis** — waits until healthy
- **API** (`localhost:3000`) — runs migrations on startup, then serves requests
- **Worker** — starts consuming scrape and verify jobs
- **Web** (`localhost:3001`) — Next.js frontend

First build takes ~3–5 minutes (Playwright downloads Chromium). Subsequent starts are fast.

### 3. Open the UI

```
http://localhost:3001
```

The UI starts empty — no promotions have been scraped yet. Click **Sync** to trigger your first scrape.

---

## Usage Guide

### Trigger a scrape

```bash
# Returns immediately with a job ID
curl -X POST http://localhost:3000/scrape
# → {"jobId":"1","message":"Scrape job enqueued"}
```

Or click the **Sync** button in the UI header.

### Monitor scrape progress

```bash
curl http://localhost:3000/scrape/1
# → {"jobId":"1","state":"active","counts":{"attempted":5,"persisted":4,"updated":0,"skipped":0,"failed":1},...}
```

The UI polls this automatically and shows live counts.

Possible states: `waiting`, `active`, `completed`, `failed`, `cancelled`

### Cancel a running scrape

```bash
curl -X POST http://localhost:3000/scrape/1/cancel
```

The worker finishes its current promotion, then stops. Records already persisted remain in the database. `GET /scrape/1` will show `state: "cancelled"` with the counts reached before stopping.

### Browse promotions via API

```bash
# All promotions (paginated)
curl "http://localhost:3000/promotions"

# Search + filter
curl "http://localhost:3000/promotions?search=sale&brand=aerie&page=1&pageSize=10"

# Date range (overlap semantics)
curl "http://localhost:3000/promotions?startDate=2026-10-01&endDate=2026-10-31"

# Single promotion
curl http://localhost:3000/promotions/1

# All brands with metadata
curl http://localhost:3000/brands
```

### Trigger verification

```bash
curl -X POST http://localhost:3000/verify
# → {"runId":1,"jobId":"2","message":"Verification job enqueued"}

# Poll for the report
curl http://localhost:3000/verify/1
```

A clean run returns:
```json
{"runId":1,"result":"clean","checkedCount":29,"discrepancyCount":0,"discrepancies":[]}
```

A run with drift returns `"result":"drift"` with a `discrepancies` array listing each changed field.

---

## Drift Demo (FR-16)

The drift demo simulates three types of data drift so you can see the verification report catch them.

**Step 1 — Run a scrape first** (database must have promotions):
```bash
curl -X POST http://localhost:3000/scrape
# Wait for it to complete (2–5 min)
curl http://localhost:3000/scrape/1
```

**Step 2 — Inject drift** (run locally, targeting the running MySQL):
```bash
# Copy .env for local use
cp .env .env.local
# Update DATABASE_URL to use localhost instead of the Docker service name:
# DATABASE_URL=mysql://promotions_user:promotions_pass@localhost:3306/promotions
npm run demo:drift
```

This makes **3 mutations**:
1. Changes a promotion's `endDate` to 2 days ago
2. Overwrites a brand's `hours` with fake data (`Mon–Fri: 9am–5pm, Sat–Sun: Closed`)
3. Inserts a ghost promotion (`sourceId: DRIFT-DEMO-FAKE-9999`) that doesn't exist at source

**Step 3 — Run verification:**
```bash
curl -X POST http://localhost:3000/verify
# Note the runId
curl http://localhost:3000/verify/1
```

Expected output shows 3 discrepancies:
- `endDate` changed on the first promotion
- `hours` changed for the first brand  
- Ghost promotion marked `gone`

**Step 4 — Reset** by re-running the scrape:
```bash
curl -X POST http://localhost:3000/scrape
```

---

## Running Tests

Tests run against committed HTML fixtures — no network access required.

```bash
# Run all tests
npm run test --workspace=apps/worker

# Or from root
npm test
```

**Test coverage:**
- `listingParser.test.ts` — 11 tests (dedup, field extraction, storeId, image URLs)
- `detailParser.test.ts` — 9 tests (name, description, image, brand link, date text)
- `brandParser.test.ts` — 13 tests (brand name, website, hours structure, social links)
- `dateParser.test.ts` — 16 tests (Today/Tomorrow/Weekday/MM-DD, timezone, URL extraction)
- `verificationDiff.test.ts` — 15 tests (no change, whitespace, CDN churn, date tolerance, field changes)

---

## Typecheck & Lint

```bash
# Typecheck all packages
npx tsc --build packages/shared/tsconfig.json packages/db/tsconfig.json
npx tsc --project apps/worker/tsconfig.json --noEmit
npx tsc --project apps/api/tsconfig.json --noEmit
npx tsc --project apps/web/tsconfig.json --noEmit
```

---

## Environment Variables

See `.env.example` for all variables. Key ones:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `mysql://...@mysql:3306/promotions` | MySQL connection string |
| `REDIS_URL` | `redis://redis:6379` | Redis connection string |
| `API_PORT` | `3000` | Fastify listen port |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000` | API URL from browser |
| `SCRAPER_REQUEST_DELAY_MS` | `1500` | Delay between page requests (ms) |
| `SCRAPER_MAX_CONCURRENCY` | `2` | Max concurrent Playwright pages |

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/promotions` | List promotions (search, dates, brand, pagination) |
| `GET` | `/promotions/:id` | Single promotion |
| `GET` | `/brands` | All brands with promotion counts and metadata |
| `POST` | `/scrape` | Enqueue scrape job → returns `jobId` |
| `GET` | `/scrape/:jobId` | Job state + counts |
| `POST` | `/scrape/:jobId/cancel` | Cancel running job |
| `POST` | `/verify` | Enqueue verification job → returns `runId` |
| `GET` | `/verify/:runId` | Verification report |

All dates are ISO 8601 UTC. The logical timezone is `America/Denver`; the API response includes `meta.timezone: "America/Denver"`.

---

## Architecture Decisions

See `DESIGN.md` for detailed reasoning. Key decisions:

- **Playwright** over got/axios: the site is fully JS-rendered; plain HTTP returns stripped text
- **Normalized brands**: separate `brands` table, not duplicated on every promotion row
- **Stable ID**: numeric deal ID from `/deals/{id}/` URL — source-assigned, durable
- **BullMQ cancellation**: Redis `cancel:{jobId}` flag polled cooperatively between promotions
- **Verification**: targeted re-check of known deal URLs (not full re-scrape)
- **Politeness**: 1.5s delay, max 2 concurrent, realistic Chrome UA

---

## Known Limitations

- **Social links**: The portal only exposes mall-wide social accounts (ShopsBriargate), not individual brand socials. `socialLinks` is always `[]`. Documented in `ASSUMPTIONS.md`.
- **"View Website" redirect**: Brand website links go through a `shopstyle.it` redirect rather than directly to the brand's domain. This is the URL the portal provides.
- **Verification on live site**: Because the live site changes infrequently, a verification run straight after a scrape usually returns clean. Use `npm run demo:drift` to demonstrate drift detection.
- **No automated scheduling**: Scrapes and verifications are triggered on-demand. Cron scheduling is a straightforward extension (BullMQ has built-in `repeat` options).
- **Relative end dates**: Dates like "Ends Today" and "Ends Saturday" are resolved against the scrape timestamp. If the scraper runs at midnight, edge cases may shift by ±1 day.
