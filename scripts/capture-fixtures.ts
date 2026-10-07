/**
 * Captures HTML snapshots for test fixtures.
 * Run once: npx ts-node -r tsconfig-paths/register scripts/capture-fixtures.ts
 *
 * Saves:
 *   tests/fixtures/listing.html       — /sales page
 *   tests/fixtures/detail.html        — one promotion detail page
 *   tests/fixtures/brand.html         — one brand store page
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://www.thepromenadeshopsatbriargate.com';
const FIXTURES_DIR = path.join(__dirname, '..', 'tests', 'fixtures');

async function capture() {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
  });

  try {
    // 1. Listing page
    console.log('Capturing listing page...');
    const listingPage = await context.newPage();
    await listingPage.goto(`${BASE_URL}/sales`, { waitUntil: 'networkidle', timeout: 30_000 });
    await listingPage.waitForTimeout(2000);
    const listingHtml = await listingPage.content();
    fs.writeFileSync(path.join(FIXTURES_DIR, 'listing.html'), listingHtml, 'utf-8');
    console.log(`  Saved listing.html (${listingHtml.length} bytes)`);

    // Extract a deal URL from the listing
    const dealUrl = await listingPage.evaluate(() => {
      const link = document.querySelector('a[href*="/deals/"]');
      return link ? (link as HTMLAnchorElement).href : null;
    });
    await listingPage.close();

    // 2. Detail page
    if (dealUrl) {
      console.log(`Capturing detail page: ${dealUrl}`);
      await new Promise(r => setTimeout(r, 1500));
      const detailPage = await context.newPage();
      await detailPage.goto(dealUrl, { waitUntil: 'networkidle', timeout: 30_000 });
      await detailPage.waitForTimeout(2000);
      const detailHtml = await detailPage.content();
      fs.writeFileSync(path.join(FIXTURES_DIR, 'detail.html'), detailHtml, 'utf-8');
      console.log(`  Saved detail.html (${detailHtml.length} bytes)`);

      // Extract brand URL from detail page
      const brandUrl = await detailPage.evaluate(() => {
        const link = document.querySelector('a[href*="/stores/"]');
        return link ? (link as HTMLAnchorElement).href : null;
      });
      await detailPage.close();

      // 3. Brand page
      if (brandUrl) {
        console.log(`Capturing brand page: ${brandUrl}`);
        await new Promise(r => setTimeout(r, 1500));
        const brandPage = await context.newPage();
        await brandPage.goto(brandUrl, { waitUntil: 'networkidle', timeout: 30_000 });
        await brandPage.waitForTimeout(2000);
        const brandHtml = await brandPage.content();
        fs.writeFileSync(path.join(FIXTURES_DIR, 'brand.html'), brandHtml, 'utf-8');
        console.log(`  Saved brand.html (${brandHtml.length} bytes)`);
        await brandPage.close();
      } else {
        console.warn('  No brand URL found on detail page — capturing lululemon directly');
        await new Promise(r => setTimeout(r, 1500));
        const brandPage = await context.newPage();
        await brandPage.goto(`${BASE_URL}/stores/1036011-lululemon/`, { waitUntil: 'networkidle', timeout: 30_000 });
        await brandPage.waitForTimeout(2000);
        const brandHtml = await brandPage.content();
        fs.writeFileSync(path.join(FIXTURES_DIR, 'brand.html'), brandHtml, 'utf-8');
        console.log(`  Saved brand.html (lululemon fallback, ${brandHtml.length} bytes)`);
        await brandPage.close();
      }
    } else {
      console.error('No deal URL found on listing page');
    }

    console.log('\nFixtures captured successfully.');
  } finally {
    await browser.close();
  }
}

capture().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
