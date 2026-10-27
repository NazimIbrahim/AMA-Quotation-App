import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'ama_quotations',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 20, // Low memory: capped connection pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },
  jwtSecret: process.env.JWT_SECRET || 'ama_ceramics_secret_key_2026_jwt_token',
  jwtExpiresIn: '7d',
  logsDir: path.join(__dirname, '../../logs'),
  backupDir: path.join(__dirname, '../../backups'),
};
