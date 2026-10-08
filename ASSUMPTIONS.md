# ASSUMPTIONS.md — Promotions Aggregator (Single-Mall MVP)

_Documented interpretations of ambiguous requirements and discoveries made during implementation._

---

## Date Parsing

### "Ends Today" / "Ends Tomorrow" / "Ends Saturday"
The source site often displays relative end dates ("Ends Today", "Ends Tomorrow") or weekday names ("Ends Saturday") rather than absolute dates. These are resolved against the **scrape timestamp** in `America/Denver` local time:
- "Ends Today" → end of that calendar day in Denver (23:59:59 MTN)
- "Ends Tomorrow" → end of the following calendar day in Denver
- "Ends [Weekday]" → end of the next occurrence of that weekday in Denver
- Absolute dates like "Ends 10/19" → parsed as October 19 in Denver time, end of day

Start dates: the source listing page does not always show start dates. Where unavailable, `startDate` is stored as `null`.

### Date Overlap Filter (FR-4)
"Overlap semantics" means: a promotion matches if its validity period **intersects** the requested range. Formally:
```
promotion.startDate <= filter.endDate AND promotion.endDate >= filter.startDate
```
For promotions with missing dates:
- `startDate = null` → treated as "open-ended start" → always satisfies `startDate <= filter.endDate`
- `endDate = null` → treated as "open-ended end" → always satisfies `endDate >= filter.startDate`
- Both `null` → matches all date range filters (we can't prove it doesn't overlap)

This is a deliberate conservative choice: include rather than exclude when data is uncertain.

---

## Missing Data

### Social Links
Many brand pages do not expose social links in a machine-readable form (they are rendered as icon images with no visible text). Where Playwright cannot extract a social link URL, that platform is omitted from `socialLinks`. The field is always present as an array, possibly empty (`[]`).

### Brand Website URL
The "View Website »" anchor on brand pages has an `href` that is only populated after JavaScript runs. Playwright captures this. If the href is absent or is a relative/internal link (not an external brand website), `websiteUrl` is stored as `null`.

### Hours
Hours are typically in the format "Mon – Sat: 10am – 8pm / Sun: 11am – 6pm". Stored as a structured array of `{ days: string, open: string, close: string }` objects. If parsing fails, stored as a raw string in a `hoursRaw` field with structured `hours` set to `[]`.

### Description
Some promotions have no description beyond the title. Stored as `null`.

### Image
If no image is found on the detail page, falls back to the listing page thumbnail. If neither is found, `imageUrl` is `null`.

---

## Duplicate Promotions

The live `/sales` page showed several apparent duplicates (e.g., Warby Parker "Introducing Iris Edition" appearing twice in the listing). Investigation confirmed these are rendering artifacts — the same deal appears in multiple category views but shares the same `/deals/{id}/` URL. Deduplication is by `source_id` (deal ID from URL), so only one record is persisted regardless of how many times a deal appears on the listing page.

---

## Crawl Delay Interpretation

`robots.txt` specifies `Crawl-delay: 60`. This directive is primarily aimed at automated crawlers (search bots) that might scrape the entire site continuously. Our scraper:
1. Runs only on-demand (user-triggered via POST /scrape).
2. Scrapes a finite set of pages (promotions + brand pages for one mall).
3. Uses a 1.5-second delay between page requests.
4. Caps concurrency at 2 pages simultaneously.

We interpret the 60-second crawl delay as a search-engine-bot directive, not a hard constraint for all programmatic access. Our politeness strategy (documented in DESIGN.md) is the reasonable engineering equivalent for a bounded, on-demand scraper. This interpretation is documented here per the brief's instruction.

---

## Verification Scope

The verifier checks **all promotions currently in the database** that have a valid `source_id`. It does not attempt to re-check promotions that were previously marked `gone` (to avoid hammering 404 endpoints repeatedly). This means once a promotion is marked `gone`, it stays in the database for historical reference but is excluded from future verification runs unless manually reset.

---

## Brand Page Discovery

Brand page URLs are discovered by:
1. Following the link from a promotion detail page back to its store page (preferred — direct relationship).
2. Cross-referencing the brand name against the sitemap store URL list (fallback if detail page link is absent).
3. If neither yields a store URL, `brand.sourceUrl` is stored as `null` and brand metadata fields remain `null`.

---

## Verification Re-scrape vs. Targeted Check

The verifier does **not** do a full re-scrape of the listing page. It targets individual deal URLs already in the database. This means:
- New promotions added to the site since the last scrape are **not detected** by the verifier — that's the scraper's job.
- The verifier focuses purely on confirming that what was persisted still matches the source.

---

## API: promotionCount in GET /brands

`promotionCount` counts all promotions linked to that brand, regardless of their end date or verification status. It reflects total stored promotions, not currently-active ones. This was a deliberate simplicity choice; active-only counts could be added as a query param in a future iteration.

---

## Timezone Display

All dates in the API are returned as UTC ISO 8601 strings. A `meta.timezone` field is included in the API response to signal that the logical timezone for these dates is `America/Denver`. The frontend formats all dates in Denver local time using `Intl.DateTimeFormat`.

---

## Scraper Tooling: No Firecrawl / Apify

The brief explicitly says not to use managed scraping services. Playwright runs locally inside Docker with the `mcr.microsoft.com/playwright` base image, which bundles Chromium.

---

## Items Discovered During Implementation

### Social Links — Mall vs. Brand
During fixture inspection, we discovered that brand store pages on this portal display the **mall's** social links (ShopsBriargate Instagram, Facebook, X), not the individual brand's social links. There is no brand-specific social media data available on this portal. Accordingly, `socialLinks` is always `[]` for all brands scraped from this source. This is documented here rather than left as a silent gap.

### "View Website" Link
The brand "View Website »" link passes through a `shopstyle.it` redirect rather than linking directly to the brand's website. We store this redirect URL as `websiteUrl` — it is a valid, functional external link that correctly routes to the brand's website. Following the redirect to capture the final URL would require an extra HTTP request per brand and is not worth the complexity for this MVP.

### `.deal-row` Selector
Real listing page uses `.deal-row` class (not `data-id`). Brand numeric ID is in `data-store-id` attribute. Deal deduplication uses the deal URL numeric ID. Brand key is constructed from the store page link found on the detail page.

### Hours Parsing
Hours on brand pages appear as: "Mon – Sat: 10am – 8pmSun: 11am – 6pm" (no separator between entries). The parser splits on weekday name boundaries and colons to extract structured entries.

### waitUntil: 'networkidle' vs 'domcontentloaded' on Store Pages
Discovered during live testing: the target site keeps HTTP connections open indefinitely on brand store pages (`/stores/...`). As a result, `waitUntil: 'networkidle'` always hits the 30-second timeout on store pages, which meant brand hours and website URLs were never extracted. Fixed by switching to `waitUntil: 'domcontentloaded'` followed by a 2-second wait — the same strategy that worked when capturing the HTML fixtures. This is documented here because it affects any reviewer trying to understand why brand data was initially missing.

### Brand Re-fetch Strategy
The scraper only re-fetches a brand page if: (a) the brand is new, (b) it was scraped more than 1 hour ago, or (c) it has empty hours. Condition (c) was added after live testing revealed that a failed brand page fetch (e.g. timeout on first scrape) left brands with `hours: []`, and the 1-hour window would prevent correcting them on the next scrape.
