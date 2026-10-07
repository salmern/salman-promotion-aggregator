import type { FastifyInstance } from 'fastify';
import { getDb } from '@promotions/db';
import { getAllBrandsWithCount } from '@promotions/db';
import { mapBrandWithCount } from '../utils/mappers';

export async function brandsRoutes(app: FastifyInstance): Promise<void> {
  const db = getDb();

  // GET /brands
  app.get('/brands', async (_request, reply) => {
    const brands = await getAllBrandsWithCount(db);
    return reply.send({
      items: brands.map(mapBrandWithCount),
      total: brands.length,
    });
  });
}
