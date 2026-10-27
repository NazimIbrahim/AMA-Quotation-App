import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import os from 'os';
import { config } from './config';
import { logger } from './utils/logger';
import { testConnection, query } from './db/connection';
import { seedDatabase } from './db/seed';
import { initWebSocketServer, getConnectedClientCount } from './ws';

import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { quotationsRouter } from './routes/quotations';
import { customersRouter } from './routes/customers';
import { productsRouter } from './routes/products';
import { paymentsRouter } from './routes/payments';
import { targetsRouter } from './routes/targets';
import { dashboardRouter } from './routes/dashboard';
import { companyRouter } from './routes/company';
import { auditRouter } from './routes/audit';
import { reportsRouter } from './routes/reports';
import { backupRouter } from './routes/backup';
import { sanitaryCatalogRouter } from './routes/sanitaryCatalog';
import { rolesRouter, ensureRolesSchema } from './routes/roles';

const app = express();
const server = http.createServer(app);

// Enable CORS for all LAN clients
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging (lightweight, excludes health check)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path !== '/api/health') {
    logger.info(`${req.method} ${req.path} from ${req.ip}`);
  }
  next();
});

// Health check endpoint for connection tests from desktop client
app.get('/api/health', async (req: Request, res: Response) => {
  const dbOk = await testConnection();
  res.json({
    status: dbOk ? 'ok' : 'degraded',
    server: 'AMA Ceramics Quotation Central Server',
    version: '2.4.7',
    dbConnected: dbOk,
    activeWsClients: getConnectedClientCount(),
    timestamp: new Date().toISOString(),
  });
});

// Mount API routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/quotations', quotationsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/products', productsRouter);
app.use('/api/sanitary-catalog', sanitaryCatalogRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/targets', targetsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/company', companyRouter);
app.use('/api/audit-logs', auditRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/backup', backupRouter);

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled server error:', { message: err.message, stack: err.stack });
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Initialize WebSocket server
initWebSocketServer(server);

// Automatically apply essential database migrations and constraints
async function runAutoMigrations() {
  try {
    logger.info('Checking and applying automatic database schema migrations...');

    // 1. Ensure sanitary_catalog_items table exists with UNIQUE constraint on item_code
    await query(`
      CREATE TABLE IF NOT EXISTS sanitary_catalog_items (
        id SERIAL PRIMARY KEY,
        item_code VARCHAR(100) NOT NULL,
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

    // 2. Ensure quotation columns and indexes exist
    await query(`
      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS assisted_sales_person_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS assisted_sales_person_name VARCHAR(120);
      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS split_share_type VARCHAR(20) DEFAULT 'percentage';
      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS primary_sales_share_percent NUMERIC(5, 2) DEFAULT 100.00;
      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS primary_sales_share_amount NUMERIC(12, 2) DEFAULT 0.00;
      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS assisted_sales_share_percent NUMERIC(5, 2) DEFAULT 0.00;
      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS assisted_sales_share_amount NUMERIC(12, 2) DEFAULT 0.00;
      CREATE INDEX IF NOT EXISTS idx_quotations_assisted_sales_person ON quotations (assisted_sales_person_id);
      ALTER TABLE quotations ADD COLUMN IF NOT EXISTS quotation_type VARCHAR(30) NOT NULL DEFAULT 'tiles';
      CREATE INDEX IF NOT EXISTS idx_quotations_type ON quotations (quotation_type);

      ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS item_code VARCHAR(100);
      ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS item_image TEXT;
      ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS mrp_price NUMERIC(12, 2) DEFAULT 0.00;
      ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS encrypted_code VARCHAR(100);
    `);

    // 3. Ensure tile_catalog_items exists for autocomplete and item memory
    await query(`
      CREATE TABLE IF NOT EXISTS tile_catalog_items (
        id SERIAL PRIMARY KEY,
        description VARCHAR(255) NOT NULL UNIQUE,
        brand VARCHAR(150),
        size VARCHAR(100),
        product_type VARCHAR(30) NOT NULL DEFAULT 'box',
        coverage_area NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        base_rate_per_sqft NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        rate_per_sqft NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        base_rate_per_box NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        rate_per_box NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        usage_count INTEGER NOT NULL DEFAULT 1,
        last_used_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_tile_catalog_description ON tile_catalog_items (description);
      CREATE INDEX IF NOT EXISTS idx_tile_catalog_usage ON tile_catalog_items (usage_count DESC, last_used_at DESC);

      -- Backfill from existing quotation items if available
      INSERT INTO tile_catalog_items (description, brand, size, product_type, coverage_area, base_rate_per_sqft, rate_per_sqft, base_rate_per_box, rate_per_box)
      SELECT DISTINCT ON (LOWER(TRIM(description))) 
        TRIM(description), brand, size, product_type, coverage_area, base_rate_per_sqft, rate_per_sqft, base_rate_per_box, rate_per_box
      FROM quotation_items
      WHERE description IS NOT NULL AND length(TRIM(description)) > 1
      ON CONFLICT (description) DO NOTHING;

      -- 4. Ensure product_encrypted_codes exists for persistent 3-letter encrypted codes
      CREATE TABLE IF NOT EXISTS product_encrypted_codes (
        id SERIAL PRIMARY KEY,
        item_name VARCHAR(255) NOT NULL,
        normalized_name VARCHAR(255) UNIQUE NOT NULL,
        encrypted_code VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_product_encrypted_codes_norm ON product_encrypted_codes (normalized_name);
      CREATE INDEX IF NOT EXISTS idx_product_encrypted_codes_code ON product_encrypted_codes (encrypted_code);

      -- 5. Ensure quotation_versions exists for full audit trail & historical version viewing
      CREATE TABLE IF NOT EXISTS quotation_versions (
        id SERIAL PRIMARY KEY,
        quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL,
        edited_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        edited_by_name VARCHAR(120),
        revision_summary TEXT,
        snapshot_data JSONB NOT NULL,
        gross_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
        discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        taxable_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        net_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        status VARCHAR(30),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_quotation_versions_unique ON quotation_versions (quotation_id, version_number);
      CREATE INDEX IF NOT EXISTS idx_quotation_versions_qid ON quotation_versions (quotation_id, version_number DESC);

      -- Backfill any existing quotations that do not yet have an initial version archived
      INSERT INTO quotation_versions (
        quotation_id, version_number, edited_by_id, edited_by_name, revision_summary,
        snapshot_data, gross_total, discount_percent, discount_amount, taxable_amount,
        net_total, status, created_at
      )
      SELECT
        q.id,
        COALESCE(q.version, 1),
        q.sales_person_id,
        q.sales_person_name,
        'Initial quotation snapshot',
        jsonb_build_object(
          'quotation', to_jsonb(q),
          'areas', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', a.id,
                'area_name', a.area_name,
                'display_order', a.display_order,
                'items', COALESCE((
                  SELECT jsonb_agg(to_jsonb(it))
                  FROM quotation_items it
                  WHERE it.area_id = a.id
                ), '[]'::jsonb)
              )
            )
            FROM quotation_areas a
            WHERE a.quotation_id = q.id
          ), '[]'::jsonb)
        ),
        q.gross_total,
        q.discount_percent,
        q.discount_amount,
        q.taxable_amount,
        q.net_total,
        q.status,
        q.created_at
      FROM quotations q
      WHERE NOT EXISTS (
        SELECT 1 FROM quotation_versions qv
        WHERE qv.quotation_id = q.id AND qv.version_number = COALESCE(q.version, 1)
      )
      ON CONFLICT (quotation_id, version_number) DO NOTHING;
    `);

    // 6. Ensure roles table and permissions schema exist
    await ensureRolesSchema();

    logger.info('Database schema migrations applied successfully.');
  } catch (err: any) {
    logger.warn('Auto migrations warning:', err.message);
  }
}

// Ensure default users and company settings exist if database was just created
async function ensureBootstrapData() {
  try {
    await runAutoMigrations();
    const userCount = await query('SELECT count(*) FROM users');
    if (parseInt(userCount[0]?.count || '0', 10) === 0) {
      logger.info('Fresh database detected (0 users). Seeding default admin, manager, accounts, and salesperson accounts...');
      await seedDatabase();
      logger.info('Default accounts and company settings seeded successfully.');
    }
  } catch (err: any) {
    logger.warn('Bootstrap data check warning:', err.message);
  }
}

// Start listening on 0.0.0.0 (all LAN interfaces)
server.listen(config.port, '0.0.0.0', async () => {
  await ensureBootstrapData();
  logger.info(`========================================================`);
  logger.info(`AMA Ceramics Quotation Central Server is running!`);
  logger.info(`Port: ${config.port}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'production'}`);
  logger.info(`Local URL: http://localhost:${config.port}`);

  // Display all available LAN IP addresses
  const networkInterfaces = os.networkInterfaces();
  logger.info(`Available LAN IP addresses for Client connection:`);
  for (const name of Object.keys(networkInterfaces)) {
    const netList = networkInterfaces[name];
    if (netList) {
      for (const net of netList) {
        if (net.family === 'IPv4' && !net.internal) {
          logger.info(`  -> http://${net.address}:${config.port} (${name})`);
        }
      }
    }
  }
  logger.info(`========================================================`);
});
