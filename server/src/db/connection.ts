import { Pool, PoolConfig, PoolClient } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

const poolConfig: PoolConfig = config.db.connectionString
  ? {
      connectionString: config.db.connectionString,
      ssl: config.db.ssl,
      max: config.db.max,
      idleTimeoutMillis: config.db.idleTimeoutMillis,
      connectionTimeoutMillis: config.db.connectionTimeoutMillis,
    }
  : {
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
      ssl: config.db.ssl,
      max: config.db.max,
      idleTimeoutMillis: config.db.idleTimeoutMillis,
      connectionTimeoutMillis: config.db.connectionTimeoutMillis,
    };

export const pool = new Pool(poolConfig);

let lastDbError: string | null = null;

export function getLastDbError(): string | null {
  return lastDbError;
}

pool.on('error', (err) => {
  lastDbError = err?.message || String(err);
  logger.error('Unexpected error on idle PostgreSQL client', err);
});

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const start = Date.now();
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    const res = await client.query(text, params);
    const duration = Date.now() - start;
    if (duration > 300) {
      logger.warn(`Slow query (${duration}ms): ${text.substring(0, 100)}`);
    }
    lastDbError = null;
    return res.rows as T[];
  } catch (err: any) {
    lastDbError = err?.message || String(err);
    throw err;
  } finally {
    if (client) {
      client.release();
    }
  }
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error: any) {
    lastDbError = error?.message || String(error);
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function testConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const rows = await query<{ ok: number }>('SELECT 1 as ok');
    const ok = rows.length > 0 && rows[0].ok === 1;
    if (ok) lastDbError = null;
    return { ok };
  } catch (err: any) {
    lastDbError = err?.message || String(err) || 'Database connection failed';
    logger.error('Database connection test failed:', lastDbError);
    return { ok: false, error: lastDbError || undefined };
  }
}
