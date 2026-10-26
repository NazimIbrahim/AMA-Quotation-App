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

    // Apply incremental alterations if upgrading existing database
    await dbClient.query(`
      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS assisted_sales_person_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS assisted_sales_person_name VARCHAR(120);
      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS split_share_type VARCHAR(20) DEFAULT 'percentage';
      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS primary_sales_share_percent NUMERIC(5, 2) DEFAULT 100.00;
      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS primary_sales_share_amount NUMERIC(12, 2) DEFAULT 0.00;
      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS assisted_sales_share_percent NUMERIC(5, 2) DEFAULT 0.00;
      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS assisted_sales_share_amount NUMERIC(12, 2) DEFAULT 0.00;
      CREATE INDEX IF NOT EXISTS idx_quotations_assisted_sales_person ON quotations (assisted_sales_person_id);
      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS quotation_type VARCHAR(30) NOT NULL DEFAULT 'tiles';
      ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS item_code VARCHAR(100);
      ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS item_image TEXT;
      ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS mrp_price NUMERIC(12, 2) DEFAULT 0.00;
      CREATE INDEX IF NOT EXISTS idx_quotations_type ON quotations (quotation_type);

      CREATE TABLE IF NOT EXISTS sanitary_catalog_items (
          id SERIAL PRIMARY KEY,
          item_code VARCHAR(100) NOT NULL UNIQUE,
          brand VARCHAR(150) NOT NULL DEFAULT 'Sanitary',
          category VARCHAR(100) NOT NULL DEFAULT 'General',
          item_description TEXT NOT NULL,
          mrp_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
          item_image TEXT,
          catalog_name VARCHAR(255),
          page_number INTEGER,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Deduplicate if any duplicates exist before adding UNIQUE constraint
      DELETE FROM sanitary_catalog_items a
      USING sanitary_catalog_items b
      WHERE a.item_code = b.item_code
        AND a.id < b.id;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'sanitary_catalog_items_item_code_key' 
            AND conrelid = 'sanitary_catalog_items'::regclass
        ) THEN
          ALTER TABLE sanitary_catalog_items 
            ADD CONSTRAINT sanitary_catalog_items_item_code_key UNIQUE (item_code);
        END IF;
      END $$;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_sanitary_catalog_code_unique ON sanitary_catalog_items (item_code);
      CREATE INDEX IF NOT EXISTS idx_sanitary_catalog_code ON sanitary_catalog_items (item_code);
      CREATE INDEX IF NOT EXISTS idx_sanitary_catalog_brand ON sanitary_catalog_items (brand);
      CREATE INDEX IF NOT EXISTS idx_sanitary_catalog_category ON sanitary_catalog_items (category);
    `);

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
