import {
  mysqlTable,
  int,
  text,
  timestamp,
  mysqlEnum,
  index,
} from 'drizzle-orm/mysql-core';

/**
 * One row per verification job execution.
 * Created by the API when POST /verify is called; updated by the worker.
 */
export const verificationRuns = mysqlTable(
  'verification_runs',
  {
    id: int('id').primaryKey().autoincrement(),

    status: mysqlEnum('status', ['running', 'completed', 'failed'])
      .notNull()
      .default('running'),

    startedAt: timestamp('started_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),

    /** How many promotions were checked in this run. */
    checkedCount: int('checked_count').notNull().default(0),

    /** How many promotions had at least one discrepancy. */
    discrepancyCount: int('discrepancy_count').notNull().default(0),

    /** How many promotions could not be verified (network/parse error). */
    failedCount: int('failed_count').notNull().default(0),

    /** Top-level error message if the whole run failed. */
    error: text('error'),
  },
  (table) => ({
    statusIdx: index('verification_runs_status_idx').on(table.status),
    startedAtIdx: index('verification_runs_started_at_idx').on(table.startedAt),
  }),
);

export type VerificationRunRow = typeof verificationRuns.$inferSelect;
export type NewVerificationRunRow = typeof verificationRuns.$inferInsert;
