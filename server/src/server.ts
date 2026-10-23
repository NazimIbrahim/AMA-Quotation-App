import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import os from 'os';
import { config } from './config';
import { logger } from './utils/logger';
import { testConnection } from './db/connection';
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

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
    version: '1.0.0',
    dbConnected: dbOk,
    activeWsClients: getConnectedClientCount(),
    timestamp: new Date().toISOString(),
  });
});

// Mount API routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/quotations', quotationsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/products', productsRouter);
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

// Start listening on 0.0.0.0 (all LAN interfaces)
server.listen(config.port, '0.0.0.0', () => {
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
