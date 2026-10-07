/**
 * Drift Demo Script — FR-16
 *
 * Intentionally mutates persisted data to simulate three types of drift,
 * so that a subsequent POST /verify will report all three as discrepancies.
 *
 * Usage (after a successful scrape):
 *   npm run demo:drift
 *
 * What it does:
 *   1. END_DATE CHANGE — changes a real promotion's endDate to 2 days in the past
 *   2. HOURS CHANGE    — overwrites a brand's hours with fake values
 *   3. GHOST RECORD    — inserts a fake promotion that doesn't exist at the source
 *
 * After running this, trigger POST /verify and then GET /verify/:runId.
 * The report should show all three discrepancies.
 *
 * Reset: re-run POST /scrape to restore the real data.
 */
import 'dotenv/config';
import { eq, sql } from 'drizzle-orm';
import { getDb, closeDb } from '../packages/db/src/connection';
import { promotions } from '../packages/db/src/schema/promotions';
import { brands } from '../packages/db/src/schema/brands';

const FAKE_SOURCE_ID = 'DRIFT-DEMO-FAKE-9999';
const SOURCE_PORTAL = 'thepromenadeshopsatbriargate';

async function main(): Promise<void> {
  const db = getDb(process.env['DATABASE_URL']);

  console.log('\n🔀  DRIFT DEMO — Injecting 3 mutations into the database\n');

  // ── Mutation 1: Change an endDate ─────────────────────────────────────────
  console.log('1️⃣  Mutation 1: Changing a promotion endDate to 2 days ago...');

  const [firstPromo] = await db
    .select({ id: promotions.id, sourceId: promotions.sourceId, name: promotions.name, endDate: promotions.endDate })
    .from(promotions)
    .where(sql`${promotions.verificationStatus} != 'gone' AND ${promotions.sourceId} != ${FAKE_SOURCE_ID}`)
    .limit(1);

  if (!firstPromo) {
    console.error('  ❌ No promotions found. Run POST /scrape first.');
    await closeDb();
    process.exit(1);
  }

  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  await db
    .update(promotions)
    .set({ endDate: twoDaysAgo, updatedAt: new Date() })
    .where(eq(promotions.id, firstPromo.id));

  console.log(`  ✅ Changed endDate of "${firstPromo.name}" (sourceId: ${firstPromo.sourceId})`);
  console.log(`     Before: ${firstPromo.endDate?.toISOString() ?? 'null'}`);
  console.log(`     After:  ${twoDaysAgo.toISOString()}`);

  // ── Mutation 2: Change brand hours ────────────────────────────────────────
  console.log('\n2️⃣  Mutation 2: Overwriting a brand\'s hours with fake data...');

  const [firstBrand] = await db
    .select({ id: brands.id, name: brands.name, hoursRaw: brands.hoursRaw })
    .from(brands)
    .limit(1);

  if (!firstBrand) {
    console.error('  ❌ No brands found. Run POST /scrape first.');
    await closeDb();
    process.exit(1);
  }

  const fakeHours = [
    { days: 'Mon – Fri', open: '9am', close: '5pm' },
    { days: 'Sat – Sun', open: 'Closed', close: 'Closed' },
  ];

  await db
    .update(brands)
    .set({
      hours: JSON.stringify(fakeHours) as unknown as typeof brands.$inferSelect.hours,
      hoursRaw: 'Mon – Fri: 9am – 5pm\nSat – Sun: Closed',
      updatedAt: new Date(),
    })
    .where(eq(brands.id, firstBrand.id));

  console.log(`  ✅ Changed hours for brand "${firstBrand.name}"`);
  console.log(`     Before: ${firstBrand.hoursRaw ?? '(none)'}`);
  console.log(`     After:  Mon – Fri: 9am – 5pm, Sat – Sun: Closed`);

  // ── Mutation 3: Insert a ghost promotion ─────────────────────────────────
  console.log('\n3️⃣  Mutation 3: Inserting a fake "ghost" promotion...');

  // Check if ghost already exists (idempotent)
  const [existing] = await db
    .select({ id: promotions.id })
    .from(promotions)
    .where(eq(promotions.sourceId, FAKE_SOURCE_ID))
    .limit(1);

  if (existing) {
    console.log(`  ⏭️  Ghost promotion already exists (id: ${existing.id}) — skipping insert`);
  } else {
    const ghostEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week from now
    await db.insert(promotions).values({
      sourceId: FAKE_SOURCE_ID,
      brandId: firstBrand.id,
      name: '[DRIFT DEMO] This Deal Does Not Exist',
      description: 'This is a fake promotion inserted by the drift demo script.',
      imageUrl: null,
      startDate: new Date(),
      endDate: ghostEndDate,
      canonicalUrl: `https://www.thepromenadeshopsatbriargate.com/deals/${FAKE_SOURCE_ID}/`,
      sourcePortal: SOURCE_PORTAL,
      scrapedAt: new Date(),
      verificationStatus: 'pending',
    });
    console.log(`  ✅ Inserted ghost promotion with sourceId "${FAKE_SOURCE_ID}"`);
    console.log(`     canonicalUrl: /deals/${FAKE_SOURCE_ID}/`);
    console.log(`     This URL does not exist at the source — verification will mark it "gone"`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n✨  All 3 mutations applied.\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Next steps:');
  console.log('  1. POST http://localhost:3000/verify');
  console.log('     → Note the returned runId');
  console.log('  2. GET  http://localhost:3000/verify/{runId}');
  console.log('     → Expect: 3 discrepancies');
  console.log('       • "endDate" field changed for', `"${firstPromo.name}"`);
  console.log('       • "hours" field changed for', `"${firstBrand.name}"`);
  console.log('       • ghost promotion marked "gone"');
  console.log('  3. POST http://localhost:3000/scrape   ← to restore real data');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await closeDb();
}

main().catch((err: unknown) => {
  console.error('Drift demo failed:', err);
  process.exit(1);
});
