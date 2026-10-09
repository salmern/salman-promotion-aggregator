import { eq, and, or, lte, gte, isNull, like, sql, count, asc, desc } from 'drizzle-orm';
import type { Db } from '../connection';
import { promotions } from '../schema/promotions';
import { brands } from '../schema/brands';
import type { NewPromotionRow, PromotionRow } from '../schema/promotions';
import type { BrandRow } from '../schema/brands';

export type PromotionUpsertData = Omit<NewPromotionRow, 'id' | 'createdAt' | 'updatedAt'>;

export type UpsertResult = 'inserted' | 'updated' | 'skipped';

/**
 * Upsert a promotion by sourceId.
 * Returns whether the record was inserted, updated, or skipped (no changes).
 */
export async function upsertPromotion(
  db: Db,
  data: PromotionUpsertData,
): Promise<{ result: UpsertResult; id: number }> {
  const existing = await db
    .select({
      id: promotions.id,
      name: promotions.name,
      description: promotions.description,
      imageUrl: promotions.imageUrl,
      startDate: promotions.startDate,
      endDate: promotions.endDate,
    })
    .from(promotions)
    .where(eq(promotions.sourceId, data.sourceId))
    .limit(1);

  if (existing.length === 0) {
    const result = await db.insert(promotions).values(data);
    return { result: 'inserted', id: result[0].insertId };
  }

  const row = existing[0]!;

  // Check if anything meaningful changed
  const hasChanges =
    row.name !== data.name ||
    row.description !== data.description ||
    row.imageUrl !== data.imageUrl ||
    row.startDate?.getTime() !== data.startDate?.getTime() ||
    row.endDate?.getTime() !== data.endDate?.getTime();

  if (!hasChanges) {
    return { result: 'skipped', id: row.id };
  }

  await db
    .update(promotions)
    .set({
      name: data.name,
      description: data.description,
      imageUrl: data.imageUrl,
      startDate: data.startDate,
      endDate: data.endDate,
      scrapedAt: data.scrapedAt,
      // Reset verification status when data changes
      verificationStatus: 'pending',
    })
    .where(eq(promotions.id, row.id));

  return { result: 'updated', id: row.id };
}

export interface PromotionWithBrand extends PromotionRow {
  brand: BrandRow;
}

export interface PromotionFilters {
  search?: string;
  startDate?: Date;
  endDate?: Date;
  brandName?: string;
  page: number;
  pageSize: number;
}

export interface PaginatedPromotions {
  items: PromotionWithBrand[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Fetch promotions with brand data, applying filters and pagination.
 *
 * Date overlap semantics (from ASSUMPTIONS.md):
 *   A promotion matches if its validity period overlaps the requested range.
 *   Missing startDate is treated as open-ended start.
 *   Missing endDate is treated as open-ended end.
 */
export async function getPromotions(
  db: Db,
  filters: PromotionFilters,
): Promise<PaginatedPromotions> {
  const conditions = [];

  // Search across promotion name and brand name
  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(
      or(
        like(promotions.name, term),
        like(brands.name, term),
        like(promotions.description, term),
      ),
    );
  }

  // Brand filter (exact match, case-insensitive via LIKE)
  if (filters.brandName) {
    conditions.push(like(brands.name, `%${filters.brandName}%`));
  }

  // Date overlap filter:
  // Promotion overlaps [filterStart, filterEnd] if:
  //   (promo.startDate IS NULL OR promo.startDate <= filterEnd)
  //   AND (promo.endDate IS NULL OR promo.endDate >= filterStart)
  if (filters.endDate) {
    conditions.push(
      or(isNull(promotions.startDate), lte(promotions.startDate, filters.endDate)),
    );
  }
  if (filters.startDate) {
    conditions.push(
      or(isNull(promotions.endDate), gte(promotions.endDate, filters.startDate)),
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const goneCondition = sql`${promotions.verificationStatus} != 'gone'`;
  const finalWhere = whereClause ? and(whereClause, goneCondition) : goneCondition;

  // Dedup at DB level: for promotions with the same (brand_id, normalised name),
  // keep only the one with the lowest id (first scraped).
  // The source site publishes some deals under multiple IDs for different
  // category filters — we store all of them but only surface one per unique deal.
  const dedupCondition = sql`${promotions.id} IN (
    SELECT MIN(p2.id)
    FROM promotions p2
    WHERE ${goneCondition}
    GROUP BY p2.brand_id, LOWER(p2.name)
  )`;

  const fullWhere = finalWhere ? and(finalWhere, dedupCondition) : dedupCondition;

  // Count deduplicated total
  const countResult = await db
    .select({ total: count() })
    .from(promotions)
    .innerJoin(brands, eq(promotions.brandId, brands.id))
    .where(fullWhere);

  const total = countResult[0]?.total ?? 0;
  const totalPages = Math.ceil(total / filters.pageSize);
  const offset = (filters.page - 1) * filters.pageSize;

  const rows = await db
    .select({
      promotion: promotions,
      brand: brands,
    })
    .from(promotions)
    .innerJoin(brands, eq(promotions.brandId, brands.id))
    .where(fullWhere)
    .orderBy(
      // Active first: NULL endDate and future dates before past dates
      sql`CASE WHEN ${promotions.endDate} IS NULL OR ${promotions.endDate} > NOW() THEN 0 ELSE 1 END`,
      asc(promotions.endDate),
    )
    .limit(filters.pageSize)
    .offset(offset);

  return {
    items: rows.map((r) => ({ ...r.promotion, brand: r.brand })),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages,
  };
}

export async function getPromotionById(
  db: Db,
  id: number,
): Promise<PromotionWithBrand | null> {
  const rows = await db
    .select({ promotion: promotions, brand: brands })
    .from(promotions)
    .innerJoin(brands, eq(promotions.brandId, brands.id))
    .where(eq(promotions.id, id))
    .limit(1);

  if (rows.length === 0 || !rows[0]) return null;
  return { ...rows[0].promotion, brand: rows[0].brand };
}

export async function getAllPromotionsForVerification(
  db: Db,
): Promise<PromotionWithBrand[]> {
  // Exclude promotions already marked 'gone' — no point re-checking 404s
  const rows = await db
    .select({ promotion: promotions, brand: brands })
    .from(promotions)
    .innerJoin(brands, eq(promotions.brandId, brands.id))
    .where(sql`${promotions.verificationStatus} != 'gone'`);

  return rows.map((r) => ({ ...r.promotion, brand: r.brand }));
}

export async function updateVerificationStatus(
  db: Db,
  promotionId: number,
  status: PromotionRow['verificationStatus'],
): Promise<void> {
  await db
    .update(promotions)
    .set({
      verificationStatus: status,
      lastVerifiedAt: new Date(),
    })
    .where(eq(promotions.id, promotionId));
}

/** Used by the drift demo script to simulate data mutations. */
export async function driftUpdatePromotion(
  db: Db,
  sourceId: string,
  patch: Partial<Pick<PromotionRow, 'endDate' | 'name' | 'description'>>,
): Promise<void> {
  await db
    .update(promotions)
    .set(patch)
    .where(eq(promotions.sourceId, sourceId));
}
