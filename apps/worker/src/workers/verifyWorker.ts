/**
 * BullMQ verification worker.
 *
 * Consumes jobs from the "verify" queue.
 * Re-checks each persisted promotion against the live source.
 * Detects: gone, changed fields, unverifiable.
 */
import { Worker, type Job } from 'bullmq';
import type { VerifyJobData } from '@promotions/shared';
import { getDb } from '@promotions/db';
import { runVerification } from '../verifier/index';
import { getRedis } from '../utils/redis';
import { logger } from '../utils/logger';

export const VERIFY_QUEUE = 'verify';

export function startVerifyWorker(): Worker {
  const redis = getRedis();
  const db = getDb();

  const worker = new Worker<VerifyJobData>(
    VERIFY_QUEUE,
    async (job: Job<VerifyJobData>) => {
      logger.info({ jobId: job.id, runId: job.data.runId }, 'Verify job started');
      await runVerification({ db, runId: job.data.runId });
      logger.info({ jobId: job.id }, 'Verify job completed');
    },
    {
      connection: redis,
      concurrency: 1,
      lockDuration: 600_000, // 10 min — verification can be slow
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: String(err) }, 'Verify worker: job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err: String(err) }, 'Verify worker error');
  });

  return worker;
}
