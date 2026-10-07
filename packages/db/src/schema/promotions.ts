import {
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
  mysqlEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/mysql-core';
import { brands } from './brands';

/**
 * One row per promotion.
 * Keyed by sourceId (numeric deal ID from /deals/{id}/ URL).
 * References brands via brandId foreign key.
 */
export const promotions = mysqlTable(
  'promotions',
  {
    id: int('id').primaryKey().autoincrement(),

    /**
     * Numeric deal ID extracted from /deals/{id}/ URL.
     * This is the stable source-assigned identifier used for upsert deduplication.
     */
    sourceId: varchar('source_id', { length: 64 }).notNull(),

    brandId: int('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'restrict', onUpdate: 'cascade' }),

    name: varchar('name', { length: 512 }).notNull(),

    /** Full promotion description. Null if only a title was available. */
    description: text('description'),

    /** High-res image URL from detail page; falls back to thumbnail. Null if unavailable. */
    imageUrl: varchar('image_url', { length: 2048 }),

    /**
     * Promotion validity dates stored as UTC timestamps.
     * The logical timezone is America/Denver — see DESIGN.md.
     * Null when not available on the source.
     */
    startDate: timestamp('start_date'),
    endDate: timestamp('end_date'),

    /** The canonical /deals/{id}/ URL on the mall portal. */
    canonicalUrl: varchar('canonical_url', { length: 2048 }).notNull(),

    /** Identifies the source mall portal. Always "thepromenadeshopsatbriargate" for this MVP. */
    sourcePortal: varchar('source_portal', { length: 255 }).notNull(),

    /** When this record was last scraped from the live source. */
    scrapedAt: timestamp('scraped_at').notNull(),

    /** When this record was last checked by the verification worker. */
    lastVerifiedAt: timestamp('last_verified_at'),

    /**
     * pending   — never verified
     * verified  — last check matched source
     * changed   — last check found field differences
     * gone      — source no longer has this deal
     * unverifiable — verification attempt failed (network/parse error)
     */
    verificationStatus: mysqlEnum('verification_status', [
      'pending',
      'verified',
      'changed',
      'gone',
      'unverifiable',
    ])
      .notNull()
      .default('pending'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    sourceIdIdx: uniqueIndex('promotions_source_id_idx').on(table.sourceId),
    brandIdIdx: index('promotions_brand_id_idx').on(table.brandId),
    endDateIdx: index('promotions_end_date_idx').on(table.endDate),
    startDateIdx: index('promotions_start_date_idx').on(table.startDate),
    // Composite for date overlap queries
    dateRangeIdx: index('promotions_date_range_idx').on(table.startDate, table.endDate),
  }),
);

export type PromotionRow = typeof promotions.$inferSelect;
export type NewPromotionRow = typeof promotions.$inferInsert;
