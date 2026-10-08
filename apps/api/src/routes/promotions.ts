import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '@promotions/db';
import { getPromotions, getPromotionById } from '@promotions/db';
import { mapPromotion } from '../utils/mappers';

const listQuerySchema = z
  .object({
    search: z.string().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD').optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD').optional(),
    brand: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine(
    (d) => !(d.startDate && d.endDate && d.endDate < d.startDate),
    { message: 'endDate must be on or after startDate' },
  );

export async function promotionsRoutes(app: FastifyInstance): Promise<void> {
  const db = getDb();

  // GET /promotions
  app.get('/promotions', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(422).send({
        statusCode: 422,
        error: 'Validation Error',
        message: parsed.error.issues.map((i) => i.message).join(', '),
      });
    }

    const q = parsed.data;

    // Parse date strings to Date objects (Denver end-of-day for range queries)
    const startDate = q.startDate ? new Date(`${q.startDate}T00:00:00.000Z`) : undefined;
    const endDate = q.endDate ? new Date(`${q.endDate}T23:59:59.999Z`) : undefined;

    const result = await getPromotions(db, {
      search: q.search,
      startDate,
      endDate,
      brandName: q.brand,
      page: q.page,
      pageSize: q.pageSize,
    });

    return reply.send({
      items: result.items.map(mapPromotion),
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
      meta: { timezone: 'America/Denver' },
    });
  });

  // GET /promotions/:id
  app.get<{ Params: { id: string } }>('/promotions/:id', async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid id' });
    }

    const promo = await getPromotionById(db, id);
    if (!promo) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: `Promotion ${id} not found` });
    }

    return reply.send(mapPromotion(promo));
  });
}
