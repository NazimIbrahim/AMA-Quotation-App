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
    const { brand_id, size, product_type, coverage_sqft, pieces_per_box, default_rate_sqft, default_rate_box } = req.body;

    if (!brand_id || !size) {
      res.status(400).json({ error: 'Brand and size are required' });
      return;
    }

    const validTypes = ['box', 'pieces', 'sqft', 'bags', 'nos'];
    const pType = product_type && validTypes.includes(String(product_type).toLowerCase())
      ? String(product_type).toLowerCase()
      : 'box';

    const cov = parseFloat(coverage_sqft) || (pType === 'box' ? 1.0 : 0.0);
    const pcs = parseInt(pieces_per_box, 10) || 1;
    const rateSqft = parseFloat(default_rate_sqft) || 0;
    const rateBox = parseFloat(default_rate_box) || (cov > 0 ? rateSqft * cov : rateSqft);

    const rows = await query(
      `INSERT INTO brand_size_coverages (
        brand_id, size, product_type, coverage_sqft, pieces_per_box, default_rate_sqft, default_rate_box
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [brand_id, size.trim(), pType, cov, pcs, rateSqft, rateBox]
    );

    res.status(201).json({ coverage: rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
