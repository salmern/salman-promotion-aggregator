import {
  mysqlTable,
  int,
  text,
  timestamp,
  mysqlEnum,
  varchar,
  index,
} from 'drizzle-orm/mysql-core';
import { verificationRuns } from './verificationRuns';
import { promotions } from './promotions';
import { brands } from './brands';

/**
 * One row per detected discrepancy within a verification run.
 * A single promotion may produce multiple rows (one per changed field).
 */
export const verificationDiscrepancies = mysqlTable(
  'verification_discrepancies',
  {
    id: int('id').primaryKey().autoincrement(),

    runId: int('run_id')
      .notNull()
      .references(() => verificationRuns.id, { onDelete: 'cascade', onUpdate: 'cascade' }),

    /** Which promotion this discrepancy is about. Null for run-level errors. */
    promotionId: int('promotion_id').references(() => promotions.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),

    /** Which brand this discrepancy is about (for brand-level field changes). */
    brandId: int('brand_id').references(() => brands.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),

    /** Human-readable promotion name for report readability without extra JOIN. */
    promotionName: varchar('promotion_name', { length: 512 }),

    /**
     * gone         — promotion no longer exists at source
     * changed      — a field value differs between stored and live
     * unverifiable — could not reach source to verify
     */
    discrepancyType: mysqlEnum('discrepancy_type', ['gone', 'changed', 'unverifiable'])
      .notNull(),

    /** Which field changed (e.g. "endDate", "name", "hours"). Null for 'gone'/'unverifiable'. */
    fieldName: varchar('field_name', { length: 128 }),

    /** The value stored in our DB before verification. */
    beforeValue: text('before_value'),

    /** The value found at the live source during verification. */
    afterValue: text('after_value'),

    /** Human-readable reason — especially for 'unverifiable'. */
    reason: text('reason'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    runIdIdx: index('verification_discrepancies_run_id_idx').on(table.runId),
    promotionIdIdx: index('verification_discrepancies_promotion_id_idx').on(table.promotionId),
  }),
);

export type VerificationDiscrepancyRow = typeof verificationDiscrepancies.$inferSelect;
export type NewVerificationDiscrepancyRow = typeof verificationDiscrepancies.$inferInsert;
