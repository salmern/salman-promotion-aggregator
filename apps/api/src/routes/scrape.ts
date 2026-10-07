/**
 * Scrape job routes.
 *
 * POST /scrape          — enqueue a scrape job, return jobId immediately
 * GET  /scrape/:jobId   — get job state + counts
 * POST /scrape/:jobId/cancel — set Redis cancellation flag
 */
import type { FastifyInstance } from 'fastify';
import { Queue } from 'bullmq';
import type { ScrapeJobData } from '@promotions/shared';
import { getRedis, setCancelled } from '../utils/redis';
import { mapJobStatus } from '../utils/mappers';
import { logger } from '../utils/logger';

const SCRAPE_QUEUE = 'scrape';

// BullMQ queue options — retries + exponential backoff
const JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5_000 },
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 50 },
};

export async function scrapeRoutes(app: FastifyInstance): Promise<void> {
  const redis = getRedis();
  const queue = new Queue<ScrapeJobData>(SCRAPE_QUEUE, { connection: redis });

  // POST /scrape
  app.post('/scrape', async (_request, reply) => {
    const job = await queue.add(
      'scrape-promotions',
      {
        triggeredAt: new Date().toISOString(),
        sourcePortal: 'thepromenadeshopsatbriargate',
      },
      JOB_OPTIONS,
    );

    logger.info({ jobId: job.id }, 'Scrape job enqueued');

    return reply.status(202).send({
      jobId: job.id,
      message: 'Scrape job enqueued',
    });
  });

  // GET /scrape/:jobId
  app.get<{ Params: { jobId: string } }>('/scrape/:jobId', async (request, reply) => {
    const job = await queue.getJob(request.params.jobId);
    if (!job) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Job ${request.params.jobId} not found`,
      });
    }

    const status = await mapJobStatus(job);
    return reply.send(status);
  });

  // POST /scrape/:jobId/cancel
  app.post<{ Params: { jobId: string } }>(
    '/scrape/:jobId/cancel',
    async (request, reply) => {
      const { jobId } = request.params;
      const job = await queue.getJob(jobId);

      if (!job) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Job ${jobId} not found`,
        });
      }

      const state = await job.getState();

      if (state === 'completed' || state === 'failed') {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: `Job ${jobId} is already ${state} and cannot be cancelled`,
        });
      }

      if (state === 'waiting' || state === 'delayed') {
        // Job hasn't started — remove it directly
        await job.remove();
        logger.info({ jobId }, 'Waiting job removed (cancelled before start)');
        return reply.send({
          jobId,
          message: 'Job cancelled (removed before it started)',
        });
      }

      // Job is active — set the Redis cancellation flag
      await setCancelled(redis, jobId);
      logger.info({ jobId }, 'Cancellation flag set for active job');

      return reply.send({
        jobId,
        message: 'Cancellation requested — job will stop after current promotion',
      });
    },
  );
}
