import { eq, sql } from 'drizzle-orm';
import type { Db } from '../connection';
import { brands } from '../schema/brands';
import { promotions } from '../schema/promotions';
import type { BrandRow, NewBrandRow } from '../schema/brands';

export type BrandUpsertData = Omit<NewBrandRow, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Upsert a brand by sourceBrandKey.
 * If the brand already exists, updates all mutable fields.
 * Returns the brand id.
 */
export async function upsertBrand(db: Db, data: BrandUpsertData): Promise<number> {
  // Check if exists first
  const existing = await db
    .select({ id: brands.id })
    .from(brands)
    .where(eq(brands.sourceBrandKey, data.sourceBrandKey))
    .limit(1);

  if (existing.length > 0 && existing[0]) {
    const id = existing[0].id;
    await db
      .update(brands)
      .set({
        name: data.name,
        websiteUrl: data.websiteUrl,
        hours: data.hours,
        hoursRaw: data.hoursRaw,
        socialLinks: data.socialLinks,
        sourceUrl: data.sourceUrl,
        scrapedAt: data.scrapedAt,
      })
      .where(eq(brands.id, id));
    return id;
  }

  const result = await db.insert(brands).values(data);
  return result[0].insertId;
}

export async function getBrandByKey(db: Db, sourceBrandKey: string): Promise<BrandRow | null> {
  const rows = await db
    .select()
    .from(brands)
    .where(eq(brands.sourceBrandKey, sourceBrandKey))
    .limit(1);
  return rows[0] ?? null;
}

export async function getBrandById(db: Db, id: number): Promise<BrandRow | null> {
  const rows = await db.select().from(brands).where(eq(brands.id, id)).limit(1);
  return rows[0] ?? null;
}

export interface BrandWithCount extends BrandRow {
  promotionCount: number;
}

export async function getAllBrandsWithCount(db: Db): Promise<BrandWithCount[]> {
  const rows = await db
    .select({
      id: brands.id,
      sourceBrandKey: brands.sourceBrandKey,
      name: brands.name,
      websiteUrl: brands.websiteUrl,
      hours: brands.hours,
      hoursRaw: brands.hoursRaw,
      socialLinks: brands.socialLinks,
      sourceUrl: brands.sourceUrl,
      scrapedAt: brands.scrapedAt,
      createdAt: brands.createdAt,
      updatedAt: brands.updatedAt,
      promotionCount: sql<number>`COUNT(${promotions.id})`.as('promotion_count'),
    })
    .from(brands)
    .leftJoin(promotions, eq(promotions.brandId, brands.id))
    .groupBy(brands.id)
    .orderBy(brands.name);

  return rows;
}
