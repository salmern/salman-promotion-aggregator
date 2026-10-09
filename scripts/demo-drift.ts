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
 *   0. RESET — resets all verification_status to 'pending' so every
 *      promotion is checked fresh on the next verify run
 *   1. END_DATE CHANGE — changes a real promotion's endDate to 2 days in the past
 *   2. HOURS CHANGE    — overwrites a brand's hours with fake values
 *   3. GHOST RECORD    — inserts (or resets) a fake promotion that doesn't exist at source
 *
 * After running this, trigger POST /verify and then GET /verify/:runId.
 * The report should show all three discrepancies.
 *
 * Reset: re-run POST /scrape to restore the real data.
 */
import 'dotenv/config';
import { eq, sql, ne } from 'drizzle-orm';
import { getDb, closeDb } from '../packages/db/src/connection';
import { promotions } from '../packages/db/src/schema/promotions';
import { brands } from '../packages/db/src/schema/brands';

const FAKE_SOURCE_ID = 'DRIFT-DEMO-FAKE-9999';
const SOURCE_PORTAL = 'thepromenadeshopsatbriargate';

async function main(): Promise<void> {
  const db = getDb(process.env['DATABASE_URL']);

  console.log('\n🔀  DRIFT DEMO — Injecting 3 mutations into the database\n');

  // ── Step 0: Reset all verification statuses to 'pending' ─────────────────
  // This ensures the verifier re-checks everything, including promotions that
  // were previously marked 'gone' from a prior drift run.
  console.log('0️⃣  Resetting all verification statuses to pending...');
  await db
    .update(promotions)
    .set({ verificationStatus: 'pending', lastVerifiedAt: null });
  console.log('  ✅ All promotions reset to pending\n');

  // ── Mutation 1: Change an endDate ─────────────────────────────────────────
  console.log('1️⃣  Mutation 1: Changing a promotion endDate to 2 days ago...');

  const [firstPromo] = await db
    .select({ id: promotions.id, sourceId: promotions.sourceId, name: promotions.name, endDate: promotions.endDate })
    .from(promotions)
    .where(sql`${promotions.sourceId} != ${FAKE_SOURCE_ID}`)
    .orderBy(promotions.id)
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

  // Pick a brand that has real hours so the diff is meaningful
  const [brandWithHours] = await db
    .select({ id: brands.id, name: brands.name, hoursRaw: brands.hoursRaw })
    .from(brands)
    .where(sql`JSON_LENGTH(hours) > 0`)
    .orderBy(brands.id)
    .limit(1);

  const targetBrand = brandWithHours ?? (await db
    .select({ id: brands.id, name: brands.name, hoursRaw: brands.hoursRaw })
    .from(brands)
    .orderBy(brands.id)
    .limit(1))[0];

  if (!targetBrand) {
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
    .where(eq(brands.id, targetBrand.id));

  console.log(`  ✅ Changed hours for brand "${targetBrand.name}"`);
  console.log(`     Before: ${targetBrand.hoursRaw ?? '(none)'}`);
  console.log(`     After:  Mon – Fri: 9am – 5pm, Sat – Sun: Closed`);

  // ── Mutation 3: Insert or reset a ghost promotion ─────────────────────────
  console.log('\n3️⃣  Mutation 3: Inserting/resetting a fake "ghost" promotion...');

  const [existing] = await db
    .select({ id: promotions.id })
    .from(promotions)
    .where(eq(promotions.sourceId, FAKE_SOURCE_ID))
    .limit(1);

  const ghostEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  if (existing) {
    // Reset it — mark pending so verifier re-checks it
    await db
      .update(promotions)
      .set({
        verificationStatus: 'pending',
        lastVerifiedAt: null,
        endDate: ghostEndDate,
        startDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(promotions.id, existing.id));
    console.log(`  ✅ Reset ghost promotion (id: ${existing.id}) back to pending`);
  } else {
    await db.insert(promotions).values({
      sourceId: FAKE_SOURCE_ID,
      brandId: targetBrand.id,
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
  }
  console.log(`     canonicalUrl: /deals/${FAKE_SOURCE_ID}/`);
  console.log(`     This URL does not exist at source — verification will mark it "gone"`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n✨  All 3 mutations applied.\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Next steps:');
  console.log('  1. POST http://localhost:3000/verify');
  console.log('     → Note the returned runId');
  console.log('  2. GET  http://localhost:3000/verify/{runId}');
  console.log('     → Expect: 3 discrepancies');
  console.log('       • "endDate" field changed for', `"${firstPromo.name}"`);
  console.log('       • "hours" field changed for', `"${targetBrand.name}"`);
  console.log('       • ghost promotion marked "gone"');
  console.log('  3. POST http://localhost:3000/scrape   ← to restore real data');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await closeDb();
}

main().catch((err: unknown) => {
  console.error('Drift demo failed:', err);
  process.exit(1);
});
