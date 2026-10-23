import { Router, Request, Response } from 'express';
import { query } from '../db/connection';
import { authenticateToken, requireRole } from '../middleware/auth';
import { recordAuditLog } from '../utils/audit';

export const productsRouter = Router();

productsRouter.use(authenticateToken);

// List tile brands
productsRouter.get('/brands', async (req: Request, res: Response) => {
  try {
    const rows = await query('SELECT * FROM tile_brands WHERE is_active = true ORDER BY name ASC');
    res.json({ brands: rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create tile brand
productsRouter.post('/brands', requireRole(['admin', 'manager']), async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Brand name is required' });
      return;
    }

    const rows = await query(
      `INSERT INTO tile_brands (name, description) VALUES ($1, $2) RETURNING *`,
      [name.trim(), description?.trim() || '']
    );

    await recordAuditLog({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'BRAND_CREATED',
      entityType: 'tile_brand',
      entityId: rows[0].id,
      details: { name },
      ipAddress: req.ip,
    });

    res.status(201).json({ brand: rows[0] });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Brand name already exists' });
      return;
    }
    res.status(500).json({ error: error.message });
  }
});

// List brand size coverages
productsRouter.get('/coverages', async (req: Request, res: Response) => {
  try {
    const { brand_id } = req.query;
    let sql = `
      SELECT c.*, b.name as brand_name
      FROM brand_size_coverages c
      JOIN tile_brands b ON b.id = c.brand_id
      WHERE c.is_active = true
    `;
    const params: any[] = [];
    if (brand_id) {
      sql += ' AND c.brand_id = $1';
      params.push(brand_id);
    }
    sql += ' ORDER BY b.name ASC, c.size ASC';

    const rows = await query(sql, params);
    res.json({ coverages: rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create/Update brand size coverage
productsRouter.post('/coverages', requireRole(['admin', 'manager']), async (req: Request, res: Response) => {
  try {
    const { brand_id, size, coverage_sqft, pieces_per_box, default_rate_sqft, default_rate_box } = req.body;

    if (!brand_id || !size || !coverage_sqft) {
      res.status(400).json({ error: 'Brand, size, and sqft coverage are required' });
      return;
    }

    const rateSqft = parseFloat(default_rate_sqft) || 0;
    const rateBox = parseFloat(default_rate_box) || (rateSqft * parseFloat(coverage_sqft));

    const rows = await query(
      `INSERT INTO brand_size_coverages (
        brand_id, size, coverage_sqft, pieces_per_box, default_rate_sqft, default_rate_box
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [brand_id, size.trim(), parseFloat(coverage_sqft), parseInt(pieces_per_box, 10) || 1, rateSqft, rateBox]
    );

    res.status(201).json({ coverage: rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
