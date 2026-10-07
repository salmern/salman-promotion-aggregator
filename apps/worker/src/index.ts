/**
 * Worker process entry point.
 * Starts BullMQ consumers for scrape and verify queues.
 */
import 'dotenv/config';
import { runMigrations } from '@promotions/db';
import { startScrapeWorker } from './workers/scrapeWorker';
import { startVerifyWorker } from './workers/verifyWorker';
import { logger } from './utils/logger';
import { closeRedis } from './utils/redis';
import { closeDb } from '@promotions/db';

async function main(): Promise<void> {
  logger.info('Worker starting...');

  // Run DB migrations on startup
  await runMigrations();

  const scrapeWorker = startScrapeWorker();
  const verifyWorker = startVerifyWorker();

  logger.info('Workers ready — listening for jobs');

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutting down workers...');
    await scrapeWorker.close();
    await verifyWorker.close();
    await closeRedis();
    await closeDb();
    logger.info('Workers shut down cleanly');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  logger.error({ err }, 'Worker failed to start');
  process.exit(1);
});
