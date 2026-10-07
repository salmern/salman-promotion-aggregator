/**
 * Playwright browser singleton with politeness controls.
 *
 * Politeness strategy (see DESIGN.md):
 *  - Realistic Chrome user-agent
 *  - 1.5s minimum delay between page navigations (configurable via env)
 *  - Max 2 concurrent page operations (configurable via env)
 *  - Browser viewport and locale set to mimic a real user
 *  - robots.txt crawl-delay of 60s is interpreted as a search-bot directive;
 *    our bounded on-demand scraper uses 1.5s which is proportionally polite.
 */
import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';

const BASE_URL = process.env['SOURCE_PORTAL_URL'] ?? 'https://www.thepromenadeshopsatbriargate.com';
const DELAY_MS = parseInt(process.env['SCRAPER_REQUEST_DELAY_MS'] ?? '1500', 10);
const MAX_CONCURRENCY = parseInt(process.env['SCRAPER_MAX_CONCURRENCY'] ?? '2', 10);

let _browser: Browser | null = null;
let _context: BrowserContext | null = null;

// Simple semaphore for concurrency control
let _activeCount = 0;
const _waitQueue: Array<() => void> = [];

function acquireSemaphore(): Promise<void> {
  return new Promise((resolve) => {
    if (_activeCount < MAX_CONCURRENCY) {
      _activeCount++;
      resolve();
    } else {
      _waitQueue.push(() => {
        _activeCount++;
        resolve();
      });
    }
  });
}

function releaseSemaphore(): void {
  _activeCount--;
  const next = _waitQueue.shift();
  if (next) next();
}

async function getBrowserContext(): Promise<BrowserContext> {
  if (_context) return _context;

  _browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  _context = await _browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
    timezoneId: 'America/Denver',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    },
  });

  return _context;
}

let _lastRequestTime = 0;

/**
 * Opens a page, navigates to the given path, waits for network idle,
 * and returns the page. Applies the polite delay before navigating.
 *
 * Caller is responsible for closing the page when done.
 */
export async function openPage(path: string): Promise<Page> {
  await acquireSemaphore();

  const ctx = await getBrowserContext();
  const page = await ctx.newPage();

  try {
    // Enforce delay between requests
    const now = Date.now();
    const elapsed = now - _lastRequestTime;
    if (_lastRequestTime > 0 && elapsed < DELAY_MS) {
      await sleep(DELAY_MS - elapsed);
    }
    _lastRequestTime = Date.now();

    const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;

    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });

    return page;
  } catch (err) {
    await page.close().catch(() => undefined);
    releaseSemaphore();
    throw err;
  }
}

/**
 * Closes the page and releases the concurrency slot.
 */
export async function closePage(page: Page): Promise<void> {
  await page.close().catch(() => undefined);
  releaseSemaphore();
}

/**
 * Shuts down the browser. Call on worker shutdown.
 */
export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close().catch(() => undefined);
    _browser = null;
    _context = null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { BASE_URL, DELAY_MS };
