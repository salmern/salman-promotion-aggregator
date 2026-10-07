import IORedis from 'ioredis';

let _redis: IORedis | null = null;

export function getRedis(): IORedis {
  if (_redis) return _redis;
  const url = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  _redis = new IORedis(url, {
    maxRetriesPerRequest: null,
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

export const cancelKey = (jobId: string): string => `cancel:${jobId}`;

export async function setCancelled(redis: IORedis, jobId: string): Promise<void> {
  await redis.set(cancelKey(jobId), '1', 'EX', 600);
}
