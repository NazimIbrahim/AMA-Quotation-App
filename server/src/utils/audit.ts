import { query } from '../db/connection';
import { logger } from './logger';

export async function recordAuditLog(params: {
  userId?: number;
  username?: string;
  action: string;
  entityType: string;
  entityId?: string | number;
  details?: any;
  ipAddress?: string | string[];
}): Promise<void> {
  try {
    const ipStr = Array.isArray(params.ipAddress) ? params.ipAddress.join(',') : (params.ipAddress || null);
    await query(
      `INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, details_json, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        params.userId || null,
        params.username || 'system',
        params.action,
        params.entityType,
        params.entityId ? String(params.entityId) : null,
        params.details ? JSON.stringify(params.details) : null,
        ipStr,
      ]
    );
  } catch (err: any) {
    logger.error('Failed to write audit log:', err.message);
  }
}
