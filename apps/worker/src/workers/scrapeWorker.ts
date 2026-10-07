/**
 * BullMQ scrape worker.
 *
 * Consumes jobs from the "scrape" queue.
 * Each job runs a full Playwright scrape of the mall promotions portal.
 *
 * Job reliability:
 *  - 3 attempts with exponential backoff (5s → 10s → 20s)
 *  - 5-minute per-job timeout
 *  - Individual promotion failures increment counts but do NOT fail the job
 *  - Cancellation: polls Redis cancel:{jobId} key between each promotion
 *
 * Progress is written to job.updateData() so GET /scrape/:jobId can read counts.
 */
import { Worker, type Job } from 'bullmq';
import type { ScrapeJobData, ScrapeJobCounts } from '@promotions/shared';
import { getDb } from '@promotions/db';
import { runScrape, CancellationError } from '../scraper/index';
import { getRedis, isCancelledFlag, clearCancelled } from '../utils/redis';
import { logger } from '../utils/logger';

export const SCRAPE_QUEUE = 'scrape';

export interface ScrapeJobProgress extends ScrapeJobCounts {
  status: 'running' | 'done' | 'cancelled';
}

export function startScrapeWorker(): Worker {
  const redis = getRedis();
  const db = getDb();

  const worker = new Worker<ScrapeJobData, ScrapeJobProgress>(
    SCRAPE_QUEUE,
    async (job: Job<ScrapeJobData, ScrapeJobProgress>) => {
      logger.info({ jobId: job.id }, 'Scrape job started');

      const counts: ScrapeJobProgress = {
        attempted: 0,
        persisted: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        status: 'running',
      };

      await job.updateData({ ...job.data, ...counts });

      try {
        const result = await runScrape({
          db,
          onProgress: async (progress) => {
            counts.attempted = progress.attempted;
            counts.persisted = progress.persisted;
            counts.updated = progress.updated;
            counts.skipped = progress.skipped;
            counts.failed = progress.failed;
            await job.updateData({ ...job.data, ...counts });
          },
          isCancelled: async () => {
            if (!job.id) return false;
            return isCancelledFlag(redis, job.id);
          },
        });

        counts.attempted = result.attempted;
        counts.persisted = result.persisted;
        counts.updated = result.updated;
        counts.skipped = result.skipped;
        counts.failed = result.failed;
        counts.status = 'done';

        await job.updateData({ ...job.data, ...counts });

        logger.info({ jobId: job.id, ...result }, 'Scrape job completed');
        return counts;
      } catch (err) {
        if (err instanceof CancellationError) {
          counts.status = 'cancelled';
          await job.updateData({ ...job.data, ...counts });
          if (job.id) await clearCancelled(redis, job.id);
          // Re-throw with a recognizable prefix so the API can detect cancellation
          throw new Error(`CANCELLED: ${err.message}`);
        }
        logger.error({ jobId: job.id, err: String(err) }, 'Scrape job failed');
        throw err;
      }
    },
    {
      connection: redis,
      concurrency: 1,
      // 5-minute hard timeout per job
      lockDuration: 300_000,
    },
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Scrape worker: job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: String(err) }, 'Scrape worker: job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err: String(err) }, 'Scrape worker error');
  });

  return worker;
}
