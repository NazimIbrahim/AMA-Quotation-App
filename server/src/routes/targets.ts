import { Router, Request, Response } from 'express';
import { query } from '../db/connection';
import { authenticateToken, requireRole } from '../middleware/auth';
import { recordAuditLog } from '../utils/audit';
import { broadcast } from '../ws';

export const targetsRouter = Router();

targetsRouter.use(authenticateToken);

// 1. List targets
targetsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { salesperson_id, target_type, year } = req.query;

    let sql = `
      SELECT t.*, u.full_name as sales_person_name
      FROM sales_targets t
      JOIN users u ON u.id = t.sales_person_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (salesperson_id) {
      sql += ` AND t.sales_person_id = $${idx++}`;
      params.push(salesperson_id);
    }
    if (target_type) {
      sql += ` AND t.target_type = $${idx++}`;
      params.push(target_type);
    }
    if (year) {
      sql += ` AND t.year = $${idx++}`;
      params.push(year);
    }

    sql += ' ORDER BY t.start_date DESC';
    const rows = await query(sql, params);
    res.json({ targets: rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Create Target (Manager / Admin)
targetsRouter.post('/', requireRole(['admin', 'manager']), async (req: Request, res: Response) => {
  try {
    const { sales_person_id, target_type, start_date, end_date, target_amount, notes, period_label } = req.body;

    if (!sales_person_id || !target_type || !start_date || !end_date || !target_amount) {
      res.status(400).json({ error: 'Salesperson, target type, dates, and amount are required' });
      return;
    }

    const startObj = new Date(start_date);
    const year = startObj.getFullYear();
    const month = startObj.getMonth() + 1;
    const label = period_label || `${target_type} Target (${start_date} to ${end_date})`;

    const rows = await query(
      `INSERT INTO sales_targets (
        sales_person_id, target_type, start_date, end_date, year, month, period_label, target_amount, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [sales_person_id, target_type, start_date, end_date, year, month, label, parseFloat(target_amount), notes || '']
    );

    await recordAuditLog({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'TARGET_CREATED',
      entityType: 'sales_target',
      entityId: rows[0].id,
      details: { sales_person_id, target_type, target_amount },
      ipAddress: req.ip,
    });

    broadcast({ type: 'TARGET_UPDATED', payload: { sales_person_id } });

    res.status(201).json({ target: rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Salesperson Performance Analytics (Target vs Actual Achievement)
targetsRouter.get('/performance', async (req: Request, res: Response) => {
  try {
    const { start_date, end_date } = req.query;

    const startDate = (start_date as string) || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endDate = (end_date as string) || new Date().toISOString().split('T')[0];

    // Get all salespersons
    const salespersons = await query(
      `SELECT id, full_name, email, phone, monthly_target
       FROM users WHERE role IN ('salesperson', 'manager') AND is_active = true
       ORDER BY full_name ASC`
    );

    // Get target amounts in period
    const targets = await query(
      `SELECT sales_person_id, COALESCE(SUM(target_amount), 0) as total_target
       FROM sales_targets
       WHERE start_date >= $1 AND end_date <= $2
       GROUP BY sales_person_id`,
      [startDate, endDate]
    );

    // Get actual achieved sales (approved/closed quotations created in this period)
    const achievements = await query(
      `SELECT sales_person_id,
              count(*) as quotations_count,
              COALESCE(SUM(net_total), 0) as total_achieved
       FROM quotations
       WHERE quotation_date >= $1 AND quotation_date <= $2
         AND status IN ('approved', 'closed')
       GROUP BY sales_person_id`,
      [startDate, endDate]
    );

    // Get payments collected in this period by salesperson's quotations
    const collections = await query(
      `SELECT q.sales_person_id,
              COALESCE(SUM(p.amount), 0) as total_collected
       FROM payments p
       JOIN quotations q ON q.id = p.quotation_id
       WHERE p.payment_date >= $1 AND p.payment_date <= $2
         AND p.status = 'Cleared'
       GROUP BY q.sales_person_id`,
      [startDate, endDate]
    );

    const targetMap = new Map(targets.map((t) => [t.sales_person_id, parseFloat(t.total_target)]));
    const achieveMap = new Map(achievements.map((a) => [a.sales_person_id, { count: parseInt(a.quotations_count, 10), amount: parseFloat(a.total_achieved) }]));
    const collectMap = new Map(collections.map((c) => [c.sales_person_id, parseFloat(c.total_collected)]));

    const performance = salespersons.map((sp) => {
      const explicitTarget = targetMap.get(sp.id) || 0;
      const target = explicitTarget > 0 ? explicitTarget : parseFloat(sp.monthly_target) || 0;
      const achieveData = achieveMap.get(sp.id) || { count: 0, amount: 0 };
      const collected = collectMap.get(sp.id) || 0;
      const percentage = target > 0 ? parseFloat(((achieveData.amount / target) * 100).toFixed(1)) : 0;

      return {
        salesperson: sp,
        target,
        achieved: achieveData.amount,
        quotationsCount: achieveData.count,
        collected,
        percentage,
        difference: parseFloat((achieveData.amount - target).toFixed(2)),
      };
    });

    res.json({
      period: { startDate, endDate },
      performance,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
