import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from './schema';

export type Db = ReturnType<typeof drizzle<typeof schema>>;

let _db: Db | null = null;
let _pool: mysql.Pool | null = null;

/**
 * Returns a singleton Drizzle instance backed by a mysql2 connection pool.
 * Call this once at startup; it is safe to call multiple times.
 */
export function getDb(databaseUrl?: string): Db {
  if (_db) return _db;

  const url = databaseUrl ?? process.env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  _pool = mysql.createPool({
    uri: url,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Enable named timezone support
    timezone: '+00:00',
  });

  _db = drizzle(_pool, { schema, mode: 'default' });
  return _db;
}

/**
 * Closes the connection pool. Call during graceful shutdown.
 */
export async function closeDb(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
  }
}
