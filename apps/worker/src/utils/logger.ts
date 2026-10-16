import pino from 'pino';

/**
 * Logger configuration.
 *
 * Uses pino-pretty for human-readable output in development.
 * Falls back to structured JSON in production or when pino-pretty
 * is not installed (e.g. Docker image built with --omit=dev).
 *
 * This guards against the crash caused by NODE_ENV=development in .env
 * while pino-pretty is absent from the production Docker image.
 */
function buildTransport(): pino.TransportSingleOptions | undefined {
  if (process.env['NODE_ENV'] === 'production') return undefined;
  try {
    require.resolve('pino-pretty');
    return { target: 'pino-pretty', options: { colorize: true } };
  } catch {
    // pino-pretty not installed (production Docker image) — use JSON output
    return undefined;
  }
}

export const logger = pino({
  name: 'worker',
  level: process.env['LOG_LEVEL'] ?? 'info',
  transport: buildTransport(),
});
