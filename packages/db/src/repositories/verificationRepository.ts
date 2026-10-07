import { eq } from 'drizzle-orm';
import type { Db } from '../connection';
import { verificationRuns } from '../schema/verificationRuns';
import { verificationDiscrepancies } from '../schema/verificationDiscrepancies';
import type {
  VerificationRunRow,
  NewVerificationRunRow,
} from '../schema/verificationRuns';
import type {
  VerificationDiscrepancyRow,
  NewVerificationDiscrepancyRow,
} from '../schema/verificationDiscrepancies';

export async function createVerificationRun(db: Db): Promise<number> {
  const result = await db.insert(verificationRuns).values({
    status: 'running',
    startedAt: new Date(),
  });
  return result[0].insertId;
}

export async function getVerificationRun(
  db: Db,
  runId: number,
): Promise<VerificationRunRow | null> {
  const rows = await db
    .select()
    .from(verificationRuns)
    .where(eq(verificationRuns.id, runId))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateVerificationRun(
  db: Db,
  runId: number,
  patch: Partial<
    Pick<
      VerificationRunRow,
      'status' | 'completedAt' | 'checkedCount' | 'discrepancyCount' | 'failedCount' | 'error'
    >
  >,
): Promise<void> {
  await db.update(verificationRuns).set(patch).where(eq(verificationRuns.id, runId));
}

export async function insertDiscrepancy(
  db: Db,
  data: Omit<NewVerificationDiscrepancyRow, 'id' | 'createdAt'>,
): Promise<void> {
  await db.insert(verificationDiscrepancies).values(data);
}

export async function getDiscrepanciesForRun(
  db: Db,
  runId: number,
): Promise<VerificationDiscrepancyRow[]> {
  return db
    .select()
    .from(verificationDiscrepancies)
    .where(eq(verificationDiscrepancies.runId, runId))
    .orderBy(verificationDiscrepancies.createdAt);
}
