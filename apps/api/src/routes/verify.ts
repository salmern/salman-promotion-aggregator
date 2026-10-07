/**
 * Verification routes.
 *
 * POST /verify         — enqueue a verification job, return runId immediately
 * GET  /verify/:runId  — get verification report
 */
import type { FastifyInstance } from 'fastify';
import { Queue } from 'bullmq';
import type { VerifyJobData } from '@promotions/shared';
import { getDb } from '@promotions/db';
import {
  createVerificationRun,
  getVerificationRun,
  getDiscrepanciesForRun,
} from '@promotions/db';
import { getRedis } from '../utils/redis';
import { mapVerificationReport } from '../utils/mappers';
import { logger } from '../utils/logger';

const VERIFY_QUEUE = 'verify';

export async function verifyRoutes(app: FastifyInstance): Promise<void> {
  const redis = getRedis();
  const db = getDb();
  const queue = new Queue<VerifyJobData>(VERIFY_QUEUE, { connection: redis });

  // POST /verify
  app.post('/verify', async (_request, reply) => {
    // Create the run record first so we have a runId to pass to the worker
    const runId = await createVerificationRun(db);

    const job = await queue.add(
      'verify-promotions',
      {
        triggeredAt: new Date().toISOString(),
        runId,
      },
      {
        attempts: 1, // Verification is not retried — partial runs are reported
        removeOnComplete: { count: 20 },
        removeOnFail: { count: 20 },
      },
    );

    logger.info({ jobId: job.id, runId }, 'Verify job enqueued');

    return reply.status(202).send({
      runId,
      jobId: job.id,
      message: 'Verification job enqueued',
    });
  });

  // GET /verify/:runId
  app.get<{ Params: { runId: string } }>('/verify/:runId', async (request, reply) => {
    const runId = parseInt(request.params.runId, 10);
    if (isNaN(runId)) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid runId' });
    }

    const run = await getVerificationRun(db, runId);
    if (!run) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Verification run ${runId} not found`,
      });
    }

    const discrepancies = await getDiscrepanciesForRun(db, runId);
    return reply.send(mapVerificationReport(run, discrepancies));
  });
}
