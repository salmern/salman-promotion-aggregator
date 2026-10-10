# Promotions Aggregator — Single-Mall MVP

A production-oriented pipeline that scrapes promotions from The Promenade Shops at Briargate, demonstrating robust patterns for background job processing, data verification, and type-safe API design.

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

**Ports:**
- `localhost:3001` — Next.js UI (open this in your browser)
- `localhost:3000` — Fastify REST API
- `localhost:3306` — MySQL (internal, exposed for tooling)
- `localhost:6379` — Redis (internal)

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

For running the drift demo script and tests locally:
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

This starts five services in dependency order:
- **MySQL** — waits until healthy
- **Redis** — waits until healthy
- **API** (`localhost:3000`) — runs DB migrations on startup, then serves requests
- **Worker** — starts consuming scrape and verify jobs from the queue
- **Web** (`localhost:3001`) — Next.js frontend

First build takes **3–5 minutes** — Playwright downloads Chromium (~200MB) inside the worker container. Subsequent starts are fast (cached layers).

### 3. Open the UI

```
http://localhost:3001
```

The UI starts empty — no promotions have been scraped yet. Click **Sync** in the header to trigger your first scrape.

---

## Usage Guide

### Trigger a scrape

Click **Sync** in the UI header — it returns a job ID immediately and shows live progress counts.

Or via API:
```bash
curl -X POST http://localhost:3000/scrape
# → {"jobId":"1","message":"Scrape job enqueued"}
```

### Monitor scrape progress

The UI header updates every 3 seconds: `5 checked, 3 new · Cancel`

Or via API:
```bash
curl http://localhost:3000/scrape/1
# → {"state":"active","counts":{"attempted":5,"persisted":3,...}}
```

### Cancel a running scrape

Click **Cancel** in the UI header while a scrape is running.

Or via API:
```bash
curl -X POST http://localhost:3000/scrape/1/cancel
```

The worker finishes its current promotion then stops cooperatively. Records already persisted remain in the database.

### Browse promotions

Open `http://localhost:3001` — use the search box, date range filter, and brand dropdown to filter. Toggle between **All** and **By Brand** views. Click any card for full details.

### Trigger verification

Click **Verify** in the UI header. The report panel appears below the hero when complete:
- **All clear** — green indicator, all promotions match the live source
- **Issues found** — lists each discrepancy with the exact field and before/after values

Or via API:
```bash
curl -X POST http://localhost:3000/verify
# → {"runId":1,"jobId":"2"}

curl http://localhost:3000/verify/1
# → {"result":"clean","checkedCount":30,"discrepancyCount":0,"discrepancies":[]}
```

---

## Drift Demo (FR-16)

Demonstrates that the verification system catches specific data changes. Run this after a completed scrape.

### Option A — From inside Docker (recommended for reviewers)

```bash
# Step 1: exec into the API container
docker compose exec api sh

# Step 2: run the drift script (DATABASE_URL already set in container)
npx ts-node --project tsconfig.scripts.json scripts/demo-drift.ts

# Step 3: exit the container
exit
```

### Option B — Locally (requires Node.js ≥ 20)

```bash
# Install dependencies if not already done
npm install

# Run with localhost DATABASE_URL (MySQL port 3306 is exposed to host)
DATABASE_URL="mysql://promotions_user:promotions_pass@localhost:3306/promotions" \
  npm run demo:drift
```

### What it does

The script makes **3 mutations** and resets all verification statuses to pending:

1. Changes a promotion's `endDate` to 2 days in the past
2. Overwrites a brand's store hours with fake values (`Mon–Fri: 9am–5pm, Sat–Sun: Closed`)
3. Inserts a ghost promotion with a URL that doesn't exist at the source

### Verify the drift

Click **Verify** in the UI — the report will show all 3 discrepancies:
- Ghost promotion: `Gone`
- Brand hours: `Changed` with before/after values
- End date: `Changed` with before/after timestamps

Or via API:
```bash
curl -X POST http://localhost:3000/verify
curl http://localhost:3000/verify/{runId}
```

### Reset

```bash
curl -X POST http://localhost:3000/scrape
# Wait for completion — this restores real data from the live source
```

---

## Running Tests

Tests run against committed HTML fixtures — no network access required.

```bash
npm run test --workspace=apps/worker
```

**Coverage:**
- `listingParser.test.ts` — 11 tests
- `detailParser.test.ts` — 9 tests
- `brandParser.test.ts` — 13 tests
- `dateParser.test.ts` — 16 tests
- `verificationDiff.test.ts` — 15 tests

**64 tests, all passing.**

---

## Typecheck

```bash
npx tsc --build packages/shared/tsconfig.json packages/db/tsconfig.json
npx tsc --project apps/worker/tsconfig.json --noEmit
npx tsc --project apps/api/tsconfig.json --noEmit
npx tsc --project apps/web/tsconfig.json --noEmit
```

---

## Environment Variables

All variables are in `.env.example`. Copy to `.env` — defaults work out of the box with Docker.

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `mysql://promotions_user:promotions_pass@mysql:3306/promotions` | MySQL connection (uses Docker service name `mysql`) |
| `REDIS_URL` | `redis://redis:6379` | Redis connection |
| `API_PORT` | `3000` | Fastify listen port |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000` | API URL used by the browser |
| `SCRAPER_REQUEST_DELAY_MS` | `1500` | Delay between Playwright page requests (ms) |
| `SCRAPER_MAX_CONCURRENCY` | `2` | Max concurrent Playwright pages |

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/promotions` | List promotions — supports `search`, `startDate`, `endDate`, `brand`, `page`, `pageSize` |
| `GET` | `/promotions/:id` | Single promotion, 404 if not found |
| `GET` | `/brands` | All brands with `promotionCount` and metadata |
| `POST` | `/scrape` | Enqueue scrape job → `{ jobId }` |
| `GET` | `/scrape/:jobId` | Job state + counts |
| `POST` | `/scrape/:jobId/cancel` | Cancel running job |
| `POST` | `/verify` | Enqueue verification job → `{ runId, jobId }` |
| `GET` | `/verify/:runId` | Full verification report with discrepancies |

All dates are ISO 8601 UTC. Logical timezone is `America/Denver` — returned in `meta.timezone`.

---

## Architecture Decisions

See `DESIGN.md` for full reasoning. Key decisions:

- **Playwright** over plain HTTP: the site is fully JS-rendered — `fetch()` returns stripped text with no links or images
- **Fastify** over Express: built-in schema validation, better TypeScript generics, lower overhead — justified deviation from the Express suggestion in the brief
- **Normalized brands**: separate `brands` table — hours/website stored once, not duplicated per promotion
- **Stable ID**: numeric deal ID from `/deals/{id}/` URL — source-assigned, durable across re-scrapes
- **Cooperative cancellation**: Redis `cancel:{jobId}` flag polled between promotions — clean stop without killing the process
- **Targeted verification**: re-checks known deal URLs, not a full re-scrape — faster, sufficient for drift detection

### Job Reliability (FR-9, NFR-5)

- `attempts: 3`, exponential backoff starting at 5s
- 5-minute hard timeout per job (`lockDuration: 300_000`)
- Per-promotion `try/catch` — one bad page increments `failed` count and continues; it never fails the whole job
- API and Worker are separate Docker services — a crashed worker has zero impact on API availability

### UI Features (FR-12, FR-13)

- Promotion cards with image, brand, end date badge, verification status badge, detail drawer
- Search across name and brand, date range filter (overlap semantics), brand dropdown
- Pagination with accurate server-side deduplication
- Group-by-brand toggle with brand hours, website link, and deal count
- Live scrape progress in header with cancel control
- Verification report panel showing clean/drift result with field-level before/after

---

## Known Limitations

- **Social links**: The portal exposes only the mall's own social accounts, not individual brand socials. `socialLinks` is always `[]`. Documented in `ASSUMPTIONS.md`.
- **Website redirect**: Brand "Visit website" links go through `shopstyle.it` — this is what the portal provides.
- **No automated scheduling**: On-demand only. BullMQ `repeat` option would add this in ~20 lines.
- **Relative dates**: "Ends Today" resolved against scrape timestamp — midnight edge cases may shift ±1 day.
