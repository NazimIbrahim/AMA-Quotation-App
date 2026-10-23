import { Router, Request, Response } from 'express';
import { query } from '../db/connection';
import { authenticateToken, requireRole } from '../middleware/auth';

export const auditRouter = Router();

auditRouter.use(authenticateToken);
auditRouter.use(requireRole(['admin', 'manager']));

auditRouter.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 30));
    const offset = (page - 1) * limit;
    const entityType = req.query.entity_type as string;
    const action = req.query.action as string;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (entityType) {
      whereClause += ` AND entity_type = $${idx++}`;
      params.push(entityType);
    }
    if (action) {
      whereClause += ` AND action = $${idx++}`;
      params.push(action);
    }

    const countRes = await query<{ count: string }>(`SELECT count(*) FROM audit_logs ${whereClause}`, params);
    const total = parseInt(countRes[0].count, 10);

    const rows = await query(
      `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    res.json({
      auditLogs: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
