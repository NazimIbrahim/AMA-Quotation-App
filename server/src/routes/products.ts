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

// Update tile brand
productsRouter.put('/brands/:id', requireRole(['admin', 'manager']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Brand name is required' });
      return;
    }

    const rows = await query(
      `UPDATE tile_brands SET name = $1, description = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
      [name.trim(), description?.trim() || '', id]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Brand not found' });
      return;
    }

    await recordAuditLog({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'BRAND_UPDATED',
      entityType: 'tile_brand',
      entityId: Number(id),
      details: { name },
      ipAddress: req.ip,
    });

    res.json({ brand: rows[0] });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Brand name already exists' });
      return;
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete tile brand (and associated size coverages)
productsRouter.delete('/brands/:id', requireRole(['admin', 'manager']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const check = await query('SELECT * FROM tile_brands WHERE id = $1', [id]);
    if (check.length === 0) {
      res.status(404).json({ error: 'Brand not found' });
      return;
    }

    // Remove associated size coverages and the brand
    await query('DELETE FROM brand_size_coverages WHERE brand_id = $1', [id]);
    await query('DELETE FROM tile_brands WHERE id = $1', [id]);

    await recordAuditLog({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'BRAND_DELETED',
      entityType: 'tile_brand',
      entityId: Number(id),
      details: { name: check[0].name },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Brand deleted successfully' });
  } catch (error: any) {
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

// Create brand size coverage
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

// Update brand size coverage
productsRouter.put('/coverages/:id', requireRole(['admin', 'manager']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { brand_id, size, product_type, coverage_sqft, pieces_per_box, default_rate_sqft, default_rate_box } = req.body;

    if (!size) {
      res.status(400).json({ error: 'Size specification is required' });
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

    let sql = `
      UPDATE brand_size_coverages
      SET size = $1, product_type = $2, coverage_sqft = $3, pieces_per_box = $4,
          default_rate_sqft = $5, default_rate_box = $6
    `;
    const params: any[] = [size.trim(), pType, cov, pcs, rateSqft, rateBox];
    let pIdx = 7;

    if (brand_id) {
      sql += `, brand_id = $${pIdx++}`;
      params.push(brand_id);
    }

    sql += ` WHERE id = $${pIdx} RETURNING *`;
    params.push(id);

    const rows = await query(sql, params);
    if (rows.length === 0) {
      res.status(404).json({ error: 'Coverage specification not found' });
      return;
    }

    res.json({ coverage: rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete all tile brands and coverages (Admin & Accounts only)
productsRouter.delete('/all', requireRole(['admin', 'accounts', 'accountant']), async (req: Request, res: Response) => {
  try {
    await query('DELETE FROM brand_size_coverages');
    await query('DELETE FROM tile_brands');
    res.json({ success: true, message: 'All tile brands and size specifications deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete brand size coverage
productsRouter.delete('/coverages/:id', requireRole(['admin', 'manager']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rows = await query('DELETE FROM brand_size_coverages WHERE id = $1 RETURNING *', [id]);
    if (rows.length === 0) {
      res.status(404).json({ error: 'Coverage specification not found' });
      return;
    }
    res.json({ success: true, message: 'Coverage specification deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Search / List saved tile catalog items for auto-complete and future reference
productsRouter.get('/tile-items', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();
    const brand = (req.query.brand as string || '').trim();
    const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 100);

    let sql = 'SELECT * FROM tile_catalog_items WHERE 1=1';
    const params: any[] = [];
    let pIdx = 1;

    if (q) {
      sql += ` AND (description ILIKE $${pIdx} OR brand ILIKE $${pIdx})`;
      params.push(`%${q}%`);
      pIdx++;
    }
    if (brand) {
      sql += ` AND brand ILIKE $${pIdx}`;
      params.push(brand);
      pIdx++;
    }

    sql += ` ORDER BY usage_count DESC, last_used_at DESC LIMIT $${pIdx}`;
    params.push(limit);

    const rows = await query(sql, params);
    res.json({ items: rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Save or Upsert single tile catalog item
productsRouter.post('/tile-items', async (req: Request, res: Response) => {
  try {
    const {
      description,
      brand,
      size,
      product_type,
      coverage_area,
      base_rate_per_sqft,
      rate_per_sqft,
      base_rate_per_box,
      rate_per_box,
    } = req.body;

    const desc = (description || '').trim();
    if (!desc) {
      res.status(400).json({ error: 'Description is required' });
      return;
    }

    const b = (brand || '').trim();
    const s = (size || '').trim();
    const pt = (product_type || 'box').trim().toLowerCase();
    const cov = parseFloat(coverage_area) || 0;
    const rSqft = parseFloat(rate_per_sqft) || 0;
    const baseSqft = parseFloat(base_rate_per_sqft) || rSqft;
    const rBox = parseFloat(rate_per_box) || 0;
    const baseBox = parseFloat(base_rate_per_box) || rBox;

    const rows = await query(
      `INSERT INTO tile_catalog_items (
        description, brand, size, product_type, coverage_area,
        base_rate_per_sqft, rate_per_sqft, base_rate_per_box, rate_per_box,
        usage_count, last_used_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, CURRENT_TIMESTAMP)
      ON CONFLICT (description) DO UPDATE SET
        brand = COALESCE(NULLIF(EXCLUDED.brand, ''), tile_catalog_items.brand),
        size = COALESCE(NULLIF(EXCLUDED.size, ''), tile_catalog_items.size),
        product_type = COALESCE(NULLIF(EXCLUDED.product_type, ''), tile_catalog_items.product_type),
        coverage_area = CASE WHEN EXCLUDED.coverage_area > 0 THEN EXCLUDED.coverage_area ELSE tile_catalog_items.coverage_area END,
        base_rate_per_sqft = CASE WHEN EXCLUDED.base_rate_per_sqft > 0 THEN EXCLUDED.base_rate_per_sqft ELSE tile_catalog_items.base_rate_per_sqft END,
        rate_per_sqft = CASE WHEN EXCLUDED.rate_per_sqft > 0 THEN EXCLUDED.rate_per_sqft ELSE tile_catalog_items.rate_per_sqft END,
        base_rate_per_box = CASE WHEN EXCLUDED.base_rate_per_box > 0 THEN EXCLUDED.base_rate_per_box ELSE tile_catalog_items.base_rate_per_box END,
        rate_per_box = CASE WHEN EXCLUDED.rate_per_box > 0 THEN EXCLUDED.rate_per_box ELSE tile_catalog_items.rate_per_box END,
        usage_count = tile_catalog_items.usage_count + 1,
        last_used_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [desc, b, s, pt, cov, baseSqft, rSqft, baseBox, rBox]
    );

    res.status(201).json({ item: rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
