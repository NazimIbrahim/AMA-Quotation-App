import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { logger } from '../utils/logger';

export async function initializeDatabase(): Promise<void> {
  logger.info('Initializing PostgreSQL database for AMA Quotations...');

  // Step 1: Connect to the default 'postgres' database to verify/create 'ama_quotations'
  const rootClient = new Client({
    host: config.db.host,
    port: config.db.port,
    database: 'postgres',
    user: config.db.user,
    password: config.db.password,
  });

  try {
    await rootClient.connect();
    const checkDb = await rootClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [config.db.database]
    );

    if (checkDb.rows.length === 0) {
      logger.info(`Database '${config.db.database}' does not exist. Creating...`);
      await rootClient.query(`CREATE DATABASE "${config.db.database}"`);
      logger.info(`Database '${config.db.database}' created successfully.`);
    } else {
      logger.info(`Database '${config.db.database}' already exists.`);
    }
  } catch (err: any) {
    logger.error('Error connecting to root postgres database:', err.message);
    throw err;
  } finally {
    await rootClient.end();
  }

  // Step 2: Connect to 'ama_quotations' and apply schema
  const dbClient = new Client(config.db);
  try {
    await dbClient.connect();
    const schemaSqlPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');

    logger.info('Applying schema.sql...');
    await dbClient.query(schemaSql);
    logger.info('Database schema applied successfully.');
  } catch (err: any) {
    logger.error('Error applying schema to database:', err.message);
    throw err;
  } finally {
    await dbClient.end();
  }
}

if (require.main === module) {
  initializeDatabase()
    .then(() => {
      logger.info('Database initialization completed.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Database initialization failed:', err);
      process.exit(1);
    });
}
