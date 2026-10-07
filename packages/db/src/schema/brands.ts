import {
  mysqlTable,
  int,
  varchar,
  text,
  json,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/mysql-core';
import type { HoursEntry, SocialLink } from '@promotions/shared';

/**
 * One row per brand at this mall portal.
 * Keyed by sourceBrandKey (slug from /stores/{id}-{slug}/ URL).
 * Brand metadata (hours, website, socials) lives here once — NOT on each promotion.
 */
export const brands = mysqlTable(
  'brands',
  {
    id: int('id').primaryKey().autoincrement(),

    /**
     * Stable key extracted from the store URL slug, e.g. "1035991-aerie".
     * Used for upsert deduplication.
     */
    sourceBrandKey: varchar('source_brand_key', { length: 255 }).notNull(),

    name: varchar('name', { length: 255 }).notNull(),

    /** External brand website (not the mall portal page). Null if unavailable. */
    websiteUrl: varchar('website_url', { length: 2048 }),

    /**
     * Structured hours as JSON: HoursEntry[].
     * Falls back to hoursRaw if parsing fails.
     */
    hours: json('hours').$type<HoursEntry[]>().notNull().default([]),

    /** Raw hours string as scraped — fallback if structured parsing fails. */
    hoursRaw: text('hours_raw'),

    /** Social links as JSON: SocialLink[]. Empty array if none found. */
    socialLinks: json('social_links').$type<SocialLink[]>().notNull().default([]),

    /** The mall portal store page URL, e.g. /stores/1035991-aerie/ */
    sourceUrl: varchar('source_url', { length: 2048 }),

    scrapedAt: timestamp('scraped_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    sourceBrandKeyIdx: uniqueIndex('brands_source_brand_key_idx').on(table.sourceBrandKey),
    nameIdx: index('brands_name_idx').on(table.name),
  }),
);

export type BrandRow = typeof brands.$inferSelect;
export type NewBrandRow = typeof brands.$inferInsert;
