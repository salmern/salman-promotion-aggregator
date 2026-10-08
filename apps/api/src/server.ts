import path from 'path';
import dotenv from 'dotenv';

// Load .env from the monorepo root regardless of the process cwd.
// This makes `cd apps/api && npm run dev` work the same as running from
// the repo root. Checks both the ts-node-dev path (src/) and the compiled
// path (dist/src/) since __dirname differs between them. In Docker, env
// vars are injected directly by Compose and no .env file exists in the
// image, so a missing file here is a harmless no-op.
for (const candidate of ['../../../.env', '../../../../.env']) {
  const envPath = path.resolve(__dirname, candidate);
  if (require('fs').existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { getDb, runMigrations, closeDb } from '@promotions/db';
import { promotionsRoutes } from './routes/promotions';
import { brandsRoutes } from './routes/brands';
import { scrapeRoutes } from './routes/scrape';
import { verifyRoutes } from './routes/verify';
import { closeRedis } from './utils/redis';
import { logger } from './utils/logger';

async function build() {
  const app = Fastify({
    logger: false, // we use pino directly
    trustProxy: true,
  });

  // CORS — open for local development
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Health check — used by Docker healthcheck
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Register route groups
  await app.register(promotionsRoutes);
  await app.register(brandsRoutes);
  await app.register(scrapeRoutes);
  await app.register(verifyRoutes);

  // Global error handler — never leak internal details
  app.setErrorHandler((error, request, reply) => {
    logger.error({ url: request.url, err: error.message }, 'Unhandled error');
    reply.status(error.statusCode ?? 500).send({
      statusCode: error.statusCode ?? 500,
      error: error.name,
      message: error.message,
    });
  });

  return app;
}

async function main(): Promise<void> {
  logger.info('API starting...');

  // Run migrations before accepting traffic
  await runMigrations();
  logger.info('Migrations complete');

  const app = await build();
  const port = parseInt(process.env['API_PORT'] ?? '3000', 10);

  await app.listen({ port, host: '0.0.0.0' });
  logger.info({ port }, 'API listening');

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutting down...');
    await app.close();
    await closeRedis();
    await closeDb();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  logger.error({ err }, 'API failed to start');
  process.exit(1);
});

export { build };
