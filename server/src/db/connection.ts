import { Pool, PoolClient } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

export const pool = new Pool(config.db);

pool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client', err);
});

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const start = Date.now();
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    const duration = Date.now() - start;
    if (duration > 300) {
      logger.warn(`Slow query (${duration}ms): ${text.substring(0, 100)}`);
    }
    return res.rows as T[];
  } finally {
    client.release();
  }
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function testConnection(): Promise<boolean> {
  try {
    const rows = await query<{ ok: number }>('SELECT 1 as ok');
    return rows.length > 0 && rows[0].ok === 1;
  } catch (err: any) {
    logger.error('Database connection test failed:', err.message);
    return false;
  }
}
