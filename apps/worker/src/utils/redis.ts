import IORedis from 'ioredis';

let _redis: IORedis | null = null;

export function getRedis(): IORedis {
  if (_redis) return _redis;
  const url = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  _redis = new IORedis(url, {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,
  });
  return _redis;
}

export async function closeRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit().catch(() => undefined);
    _redis = null;
  }
}

/** Cancellation key for a scrape job: cancel:{jobId} */
export const cancelKey = (jobId: string): string => `cancel:${jobId}`;

/** Set cancellation flag for a job (TTL 10 minutes) */
export async function setCancelled(redis: IORedis, jobId: string): Promise<void> {
  await redis.set(cancelKey(jobId), '1', 'EX', 600);
}

/** Check if a job has been cancelled */
export async function isCancelledFlag(redis: IORedis, jobId: string): Promise<boolean> {
  const val = await redis.get(cancelKey(jobId));
  return val === '1';
}

/** Clear cancellation flag */
export async function clearCancelled(redis: IORedis, jobId: string): Promise<void> {
  await redis.del(cancelKey(jobId));
}
