import { Router, Request, Response } from 'express';
import { query } from '../db/connection';
import { authenticateToken } from '../middleware/auth';
import { recordAuditLog } from '../utils/audit';
import { broadcast } from '../ws';

export const customersRouter = Router();

customersRouter.use(authenticateToken);

// Paginated customer list with debounced search
customersRouter.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const offset = (page - 1) * limit;
    const search = (req.query.search as string || '').trim();

    let whereClause = 'WHERE is_active = true';
    const params: any[] = [];
    let idx = 1;

    if (search) {
      whereClause += ` AND (name ILIKE $${idx} OR mobile_number ILIKE $${idx} OR site_location ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    const countRes = await query<{ count: string }>(
      `SELECT count(*) FROM customers ${whereClause}`,
      params
    );
    const totalCount = parseInt(countRes[0].count, 10);

    const dataSql = `
      SELECT c.*,
        COALESCE(q.quotations_count, 0) as quotations_count,
        COALESCE(q.total_quoted, 0) as total_quoted
      FROM customers c
      LEFT JOIN (
        SELECT customer_id, count(*) as quotations_count, sum(net_total) as total_quoted
        FROM quotations GROUP BY customer_id
      ) q ON q.customer_id = c.id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    params.push(limit, offset);
    const rows = await query(dataSql, params);

    res.json({
      customers: rows,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Fast customer lookup by phone, name, email, or address for autocomplete popup
customersRouter.get('/lookup', async (req: Request, res: Response) => {
  try {
    const q = ((req.query.q as string) || '').trim();
    if (!q) {
      res.json({ customers: [] });
      return;
    }
    const cleanDigits = q.replace(/\D/g, '');
    let sql = `
      SELECT id, name, mobile_number, email, delivery_address, site_location, gstin, notes
      FROM customers
      WHERE is_active = true AND (
        name ILIKE $1 
        OR mobile_number ILIKE $1 
        OR site_location ILIKE $1 
        OR email ILIKE $1 
        OR gstin ILIKE $1
    `;
    const params = [`%${q}%`];
    if (cleanDigits.length >= 3) {
      sql += ` OR REPLACE(mobile_number, ' ', '') ILIKE $2`;
      params.push(`%${cleanDigits}%`);
    }
    sql += `) ORDER BY name ASC LIMIT 10`;

    const rows = await query(sql, params);
    res.json({ customers: rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single customer with their quotations
customersRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const custRows = await query('SELECT * FROM customers WHERE id = $1', [id]);
    if (custRows.length === 0) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    const quotations = await query(
      `SELECT id, quotation_number, quotation_date, status, gross_total, net_total, project_name, created_at
       FROM quotations WHERE customer_id = $1 ORDER BY quotation_date DESC`,
      [id]
    );

    res.json({
      customer: custRows[0],
      quotations,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create new customer
customersRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, mobile_number, email, delivery_address, site_location, gstin, notes } = req.body;

    if (!name || !mobile_number) {
      res.status(400).json({ error: 'Customer name and mobile number are required' });
      return;
    }

    const rows = await query(
      `INSERT INTO customers (name, mobile_number, email, delivery_address, site_location, gstin, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name.trim(), mobile_number.trim(), email?.trim() || null, delivery_address?.trim() || '', site_location?.trim() || '', gstin?.trim() || '', notes || '']
    );

    await recordAuditLog({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'CUSTOMER_CREATED',
      entityType: 'customer',
      entityId: rows[0].id,
      details: { name, mobile_number },
      ipAddress: req.ip,
    });

    broadcast({ type: 'CUSTOMER_UPDATED', payload: { id: rows[0].id, name: rows[0].name } });

    res.status(201).json({ customer: rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update customer
customersRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { name, mobile_number, email, delivery_address, site_location, gstin, notes, is_active } = req.body;

    const rows = await query(
      `UPDATE customers
       SET name = COALESCE($1, name),
           mobile_number = COALESCE($2, mobile_number),
           email = COALESCE($3, email),
           delivery_address = COALESCE($4, delivery_address),
           site_location = COALESCE($5, site_location),
           gstin = COALESCE($6, gstin),
           notes = COALESCE($7, notes),
           is_active = COALESCE($8, is_active),
           updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [name, mobile_number, email, delivery_address, site_location, gstin, notes, is_active, id]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    await recordAuditLog({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'CUSTOMER_UPDATED',
      entityType: 'customer',
      entityId: id,
      ipAddress: req.ip,
    });

    broadcast({ type: 'CUSTOMER_UPDATED', payload: { id, name: rows[0].name } });

    res.json({ customer: rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
