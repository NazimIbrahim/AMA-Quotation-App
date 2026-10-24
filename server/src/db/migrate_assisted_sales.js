const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'ama_quotations'
});

async function migrate() {
  console.log('Adding assisted salesperson and split share columns to quotations table...');
  await pool.query(`
    ALTER TABLE quotations ADD COLUMN IF NOT EXISTS assisted_sales_person_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE quotations ADD COLUMN IF NOT EXISTS assisted_sales_person_name VARCHAR(120);
    ALTER TABLE quotations ADD COLUMN IF NOT EXISTS split_share_type VARCHAR(20) DEFAULT 'percentage';
    ALTER TABLE quotations ADD COLUMN IF NOT EXISTS primary_sales_share_percent NUMERIC(5, 2) DEFAULT 100.00;
    ALTER TABLE quotations ADD COLUMN IF NOT EXISTS primary_sales_share_amount NUMERIC(12, 2) DEFAULT 0.00;
    ALTER TABLE quotations ADD COLUMN IF NOT EXISTS assisted_sales_share_percent NUMERIC(5, 2) DEFAULT 0.00;
    ALTER TABLE quotations ADD COLUMN IF NOT EXISTS assisted_sales_share_amount NUMERIC(12, 2) DEFAULT 0.00;
    CREATE INDEX IF NOT EXISTS idx_quotations_assisted_sales_person ON quotations (assisted_sales_person_id);
  `);
  console.log('Migration successful: assisted salesperson and share split columns added.');
  await pool.end();
}

migrate().catch(e => {
  console.error('Migration failed:', e.message);
  pool.end();
  process.exit(1);
});
