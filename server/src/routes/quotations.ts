import { Router, Request, Response } from 'express';
import { query, withTransaction } from '../db/connection';
import { authenticateToken, optionalAuthenticateToken, requireRole } from '../middleware/auth';
import { generateNextQuotationNumber } from '../utils/quotationNumber';
import { generateQuotationPdf } from '../utils/pdfGenerator';
import { recordAuditLog } from '../utils/audit';
import { broadcast } from '../ws';
import { calculateQuotationDiscountAndTotals, isCeraBrand } from '../utils/discountCalculator';
import { getOrSaveEncryptedProductCodes } from '../utils/encryptedCode';

export const quotationsRouter = Router();

// Stream PDF Quotation (accessible directly via browser tab, print window, or download with optional token)
quotationsRouter.get('/:id/pdf', optionalAuthenticateToken, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const isEncrypted = req.query.encrypted === 'true' || req.query.encrypted === '1';

    const qRows = await query('SELECT * FROM quotations WHERE id = $1', [id]);
    if (qRows.length === 0) {
      res.status(404).json({ error: 'Quotation not found' });
      return;
    }

    const quotation = qRows[0];
    const areas = await query(
      'SELECT * FROM quotation_areas WHERE quotation_id = $1 ORDER BY display_order ASC',
      [id]
    );
    const items = await query(
      'SELECT * FROM quotation_items WHERE quotation_id = $1 ORDER BY sl_no ASC',
      [id]
    );
    const companyRows = await query('SELECT * FROM company_settings LIMIT 1');
    const company = companyRows[0] || {};

    let encryptedMap = new Map<string, string>();
    if (isEncrypted) {
      const allNames: string[] = [];
      for (const it of items) {
        if (it.description) allNames.push(it.description);
        if (quotation.quotation_type === 'sanitary') {
          if (it.item_code) allNames.push(it.item_code);
          if (it.size) allNames.push(it.size);
        }
      }
      encryptedMap = await getOrSaveEncryptedProductCodes(allNames);

      // Persist any resolved codes back to quotation_items if not set
      for (const it of items) {
        const code = encryptedMap.get((it.description || '').trim());
        if (code && !it.encrypted_code) {
          query('UPDATE quotation_items SET encrypted_code = $1 WHERE id = $2', [code, it.id]).catch(() => {});
        }
      }
    }

    const areasWithItems = (areas || []).map((a) => ({
      ...a,
      items: (items || []).filter((it) => it.area_id === a.id),
    }));

    const doc = generateQuotationPdf({
      quotation,
      areas: areasWithItems,
      company: {
        ...company,
        terms_json: company.terms_json
          ? (typeof company.terms_json === 'string' ? JSON.parse(company.terms_json) : company.terms_json)
          : [],
      },
      encrypted: isEncrypted,
      encryptedMap,
    });

    const filename = isEncrypted
      ? `Quotation_${quotation.quotation_number}_Encrypted.pdf`
      : `Quotation_${quotation.quotation_number}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${filename}"`
    );

    doc.pipe(res);
    doc.end();
  } catch (error: any) {
    console.error('Error generating quotation PDF:', error);
    res.status(500).json({ error: error.message });
  }
});

quotationsRouter.use(authenticateToken);

// 1. Paginated Quotation List with Server-side Filtering and Debounced Search
quotationsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const offset = (page - 1) * limit;

    const search = (req.query.search as string || '').trim();
    const status = (req.query.status as string || '').trim();
    const quotationType = (req.query.quotation_type as string || '').trim().toLowerCase();
    const salesPersonId = req.query.sales_person_id ? parseInt(req.query.sales_person_id as string, 10) : null;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    const whereClauses: string[] = ['1=1'];
    const params: any[] = [];
    let idx = 1;

    if (quotationType === 'tiles' || quotationType === 'sanitary') {
      whereClauses.push(`q.quotation_type = $${idx++}`);
      params.push(quotationType);
    }

    // Role-based scoping: Salespersons see quotations where they are primary or assisted
    if (req.user!.role === 'salesperson') {
      whereClauses.push(`(q.sales_person_id = $${idx} OR q.assisted_sales_person_id = $${idx})`);
      params.push(req.user!.id);
      idx++;
    } else if (salesPersonId) {
      whereClauses.push(`(q.sales_person_id = $${idx} OR q.assisted_sales_person_id = $${idx})`);
      params.push(salesPersonId);
      idx++;
    }

    if (status) {
      const st = status.toLowerCase();
      if (st === 'not_closed' || st === 'open') {
        whereClauses.push(`q.status IN ('draft', 'in_review', 'approved')`);
      } else {
        whereClauses.push(`q.status = $${idx++}`);
        params.push(status);
      }
    }

    if (search) {
      whereClauses.push(
        `(q.quotation_number ILIKE $${idx} OR q.customer_name ILIKE $${idx} OR q.customer_phone ILIKE $${idx} OR q.project_name ILIKE $${idx} OR q.assisted_sales_person_name ILIKE $${idx})`
      );
      params.push(`%${search}%`);
      idx++;
    }

    if (startDate) {
      whereClauses.push(`q.quotation_date >= $${idx++}`);
      params.push(startDate);
    }

    if (endDate) {
      whereClauses.push(`q.quotation_date <= $${idx++}`);
      params.push(endDate);
    }

    const whereSql = whereClauses.join(' AND ');

    // Total count and aggregate total (split-aware when filtering by salesperson)
    const targetSpId = req.user!.role === 'salesperson' ? req.user!.id : (salesPersonId || null);
    const countAmountExpr = targetSpId
      ? `COALESCE(SUM(
          CASE
            WHEN q.sales_person_id = ${targetSpId} THEN
              CASE
                WHEN q.assisted_sales_person_id IS NOT NULL AND q.primary_sales_share_amount > 0 THEN q.primary_sales_share_amount
                WHEN q.assisted_sales_person_id IS NOT NULL AND q.primary_sales_share_percent > 0 THEN ROUND((q.net_total * q.primary_sales_share_percent / 100.0)::numeric, 2)
                ELSE q.net_total
              END
            WHEN q.assisted_sales_person_id = ${targetSpId} THEN
              CASE
                WHEN q.assisted_sales_share_amount > 0 THEN q.assisted_sales_share_amount
                WHEN q.assisted_sales_share_percent > 0 THEN ROUND((q.net_total * q.assisted_sales_share_percent / 100.0)::numeric, 2)
                ELSE 0
              END
            ELSE q.net_total
          END
        ), 0)`
      : `COALESCE(SUM(q.net_total), 0)`;

    const countQuery = `
      SELECT count(*) as total_count, ${countAmountExpr} as total_amount
      FROM quotations q
      WHERE ${whereSql}
    `;
    const countRes = await query<{ total_count: string; total_amount: string }>(countQuery, params);
    const totalCount = parseInt(countRes[0].total_count, 10);
    const totalAmount = parseFloat(countRes[0].total_amount);

    // Paginated records with payments received summary
    const dataQuery = `
      SELECT
        q.id,
        q.quotation_number,
        q.quotation_date,
        q.customer_id,
        q.customer_name,
        q.customer_phone,
        q.sales_person_id,
        q.sales_person_name,
        q.assisted_sales_person_id,
        q.assisted_sales_person_name,
        q.split_share_type,
        q.primary_sales_share_percent,
        q.primary_sales_share_amount,
        q.assisted_sales_share_percent,
        q.assisted_sales_share_amount,
        q.project_name,
        q.quotation_type,
        q.status,
        q.gross_total,
        q.discount_amount,
        q.net_total,
        q.version,
        q.created_at,
        COALESCE(p.total_paid, 0) as total_paid,
        (q.net_total - COALESCE(p.total_paid, 0)) as balance_due
      FROM quotations q
      LEFT JOIN (
        SELECT quotation_id, SUM(amount) as total_paid
        FROM payments
        WHERE status = 'Cleared'
        GROUP BY quotation_id
      ) p ON p.quotation_id = q.id
      WHERE ${whereSql}
      ORDER BY q.quotation_date DESC, q.id DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    params.push(limit, offset);
    const rows = await query(dataQuery, params);

    res.json({
      quotations: rows,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      summary: {
        totalQuotations: totalCount,
        totalAmount,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get Single Quotation with Areas, Items, and Payment History
quotationsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);

    const qRows = await query(
      `SELECT q.*,
              u.full_name as approved_by_name,
              COALESCE(p.total_paid, 0) as total_paid,
              (q.net_total - COALESCE(p.total_paid, 0)) as balance_due
       FROM quotations q
       LEFT JOIN users u ON u.id = q.approved_by_id
       LEFT JOIN (
         SELECT quotation_id, SUM(amount) as total_paid
         FROM payments WHERE status = 'Cleared' GROUP BY quotation_id
       ) p ON p.quotation_id = q.id
       WHERE q.id = $1`,
      [id]
    );

    if (qRows.length === 0) {
      res.status(404).json({ error: 'Quotation not found' });
      return;
    }

    const quotation = qRows[0];

    // Enforce role scope: allow if salesperson is primary OR assisted
    if (
      req.user!.role === 'salesperson' &&
      quotation.sales_person_id !== req.user!.id &&
      quotation.assisted_sales_person_id !== req.user!.id
    ) {
      res.status(403).json({ error: 'Access denied to this quotation' });
      return;
    }

    // Fetch Areas
    const areas = await query(
      `SELECT * FROM quotation_areas WHERE quotation_id = $1 ORDER BY display_order ASC, id ASC`,
      [id]
    );

    // Fetch Items with persistent encrypted_code
    const items = await query(
      `SELECT qi.*, COALESCE(qi.encrypted_code, pec.encrypted_code) as encrypted_code
       FROM quotation_items qi
       LEFT JOIN product_encrypted_codes pec ON pec.normalized_name = LOWER(TRIM(qi.description))
       WHERE qi.quotation_id = $1
       ORDER BY qi.sl_no ASC, qi.id ASC`,
      [id]
    );

    // Group items into areas
    const areaMap = areas.map((a) => ({
      ...a,
      items: items.filter((it) => it.area_id === a.id),
    }));

    // Fetch Payments
    const payments = await query(
      `SELECT p.*, u.full_name as recorded_by_name
       FROM payments p
       LEFT JOIN users u ON u.id = p.recorded_by_id
       WHERE p.quotation_id = $1
       ORDER BY p.payment_date DESC, p.id DESC`,
      [id]
    );

    res.json({
      quotation,
      areas: areaMap,
      payments,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Helper: Calculate Totals on Server with CERA-excluded direct item rate discount
function calculateTotals(items: any[], discountPercent: number, discountAmount: number, taxType: string, quotationType?: string) {
  return calculateQuotationDiscountAndTotals(items, discountAmount, discountPercent, taxType, quotationType);
}

// 3. Create Quotation (Transactional)
quotationsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
      quotation_type = 'tiles',
      quotation_date,
      customer_id,
      customer_name,
      customer_phone,
      customer_gstin,
      delivery_address,
      site_location,
      project_name,
      status: reqStatus,
      special_notes,
      discount_percent,
      discount_amount,
      tax_type = 'cgst_sgst',
      assisted_sales_person_id,
      assisted_sales_person_name,
      split_share_type = 'percentage',
      primary_sales_share_percent,
      primary_sales_share_amount,
      assisted_sales_share_percent,
      assisted_sales_share_amount,
      areas = [],
    } = req.body;

    if (!customer_name || !customer_phone) {
      res.status(400).json({ error: 'Customer name and phone number are required' });
      return;
    }

    const qType = quotation_type === 'sanitary' ? 'sanitary' : 'tiles';

    const allItems: any[] = [];
    areas.forEach((a: any) => {
      if (Array.isArray(a.items)) {
        a.items.forEach((it: any) => allItems.push(it));
      }
    });

    const totals = calculateTotals(
      allItems,
      parseFloat(discount_percent) || 0,
      parseFloat(discount_amount) || 0,
      tax_type,
      qType
    );

    const initialStatus = reqStatus && ['draft', 'in_review', 'approved', 'closed'].includes(String(reqStatus).toLowerCase())
      ? String(reqStatus).toLowerCase()
      : 'draft';
    const isApprovedOrClosed = ['approved', 'closed'].includes(initialStatus);

    const result = await withTransaction(async (client) => {
      const qNumber = await generateNextQuotationNumber(client);

      // Compute Sales Split Shares
      let finalAssistedId: number | null = null;
      let finalAssistedName: string | null = null;
      let finalSplitType: string | null = null;
      let primaryPct = 100.0;
      let primaryAmt = totals.netTotal;
      let assistedPct = 0.0;
      let assistedAmt = 0.0;

      if (assisted_sales_person_id) {
        finalAssistedId = parseInt(assisted_sales_person_id, 10);
        const assistedUser = await client.query('SELECT full_name FROM users WHERE id = $1', [finalAssistedId]);
        finalAssistedName = assistedUser.rows[0]?.full_name || assisted_sales_person_name || 'Assisted Salesperson';
        finalSplitType = split_share_type === 'amount' ? 'amount' : 'percentage';

        if (finalSplitType === 'amount') {
          assistedAmt = Math.min(totals.netTotal, Math.max(0, parseFloat(assisted_sales_share_amount) || 0));
          primaryAmt = Math.max(0, parseFloat((totals.netTotal - assistedAmt).toFixed(2)));
          primaryPct = totals.netTotal > 0 ? parseFloat(((primaryAmt / totals.netTotal) * 100).toFixed(2)) : 100;
          assistedPct = totals.netTotal > 0 ? parseFloat(((assistedAmt / totals.netTotal) * 100).toFixed(2)) : 0;
        } else {
          assistedPct = Math.min(100, Math.max(0, parseFloat(assisted_sales_share_percent) || 0));
          primaryPct = parseFloat((100 - assistedPct).toFixed(2));
          primaryAmt = parseFloat(((totals.netTotal * primaryPct) / 100).toFixed(2));
          assistedAmt = parseFloat((totals.netTotal - primaryAmt).toFixed(2));
        }
      }

      const qRes = await client.query(
        `INSERT INTO quotations (
          quotation_number, quotation_date, customer_id, sales_person_id,
          customer_name, customer_phone, customer_gstin, delivery_address, site_location,
          sales_person_name, assisted_sales_person_id, assisted_sales_person_name,
          split_share_type, primary_sales_share_percent, primary_sales_share_amount,
          assisted_sales_share_percent, assisted_sales_share_amount,
          project_name, quotation_type, status, approved_by_id, approved_at, gross_total, discount_percent,
          discount_amount, taxable_amount, tax_type, cgst_rate, cgst_amount,
          sgst_rate, sgst_amount, igst_rate, igst_amount, round_off, net_total,
          special_notes, version
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8, $9,
          $10, $11, $12,
          $13, $14, $15,
          $16, $17,
          $18, $19, $20, $21, $22, $23, $24,
          $25, $26, $27, $28, $29,
          $30, $31, $32, $33, $34, $35,
          $36, 1
        ) RETURNING *`,
        [
          qNumber,
          quotation_date || new Date().toISOString().split('T')[0],
          customer_id || null,
          req.user!.id,
          customer_name.trim(),
          customer_phone.trim(),
          customer_gstin?.trim() || null,
          delivery_address?.trim() || '',
          site_location?.trim() || '',
          req.user!.full_name,
          finalAssistedId,
          finalAssistedName,
          finalSplitType,
          primaryPct,
          primaryAmt,
          assistedPct,
          assistedAmt,
          project_name?.trim() || '',
          qType,
          initialStatus,
          isApprovedOrClosed ? req.user!.id : null,
          isApprovedOrClosed ? new Date() : null,
          totals.grossTotal,
          parseFloat(discount_percent) || 0,
          totals.discountAmount,
          totals.taxableAmount,
          tax_type,
          totals.cgstRate,
          totals.cgstAmount,
          totals.sgstRate,
          totals.sgstAmount,
          totals.igstRate,
          totals.igstAmount,
          totals.roundOff,
          totals.netTotal,
          special_notes || '',
        ]
      );

      const newQ = qRes.rows[0];
      let itemSlNo = 1;

      // Pre-resolve and save encrypted codes for all items
      const allItemNames: string[] = [];
      for (const a of areas) {
        if (Array.isArray(a.items)) {
          for (const it of a.items) {
            const desc = (it.item_description || it.description || '').trim();
            if (desc) allItemNames.push(desc);
          }
        }
      }
      const encryptedCodesMap = await getOrSaveEncryptedProductCodes(allItemNames, (sql, p) => client.query(sql, p).then((r: any) => r.rows));

      for (let i = 0; i < areas.length; i++) {
        const area = areas[i];
        const areaRes = await client.query(
          `INSERT INTO quotation_areas (quotation_id, area_name, display_order)
           VALUES ($1, $2, $3) RETURNING id`,
          [newQ.id, area.area_name || (qType === 'sanitary' ? 'Sanitary Ware' : `Area ${i + 1}`), i + 1]
        );
        const areaId = areaRes.rows[0].id;

        if (Array.isArray(area.items)) {
          for (const item of area.items) {
            let pType = String(item.product_type || (qType === 'sanitary' ? 'nos' : 'box')).toLowerCase();
            const cov = parseFloat(item.coverage_area) || 0;
            let sqft = parseFloat(item.quantity_sqft) || 0;
            let rSqft = parseFloat(item.rate_per_sqft) || 0;
            let boxes = parseFloat(item.quantity !== undefined ? item.quantity : item.quantity_boxes) || 0;
            let rBox = parseFloat(item.discounted_price !== undefined ? item.discounted_price : item.rate_per_box) || 0;
            let total = 0;

            if (qType === 'sanitary') {
              pType = 'nos';
              const mrp = parseFloat(item.mrp_price !== undefined ? item.mrp_price : item.base_rate_per_box) || 0;
              const discPct = parseFloat(item.discount_percent) || 0;
              if (rBox <= 0 && mrp > 0) {
                rBox = parseFloat((mrp * (1 - discPct / 100)).toFixed(2));
              }
              total = parseFloat((boxes * rBox).toFixed(2));
              sqft = 0;
              rSqft = 0;
            } else if (pType === 'sqft') {
              total = parseFloat((sqft * rSqft).toFixed(2));
              boxes = 0;
              rBox = 0;
            } else if (['bags', 'pieces', 'nos'].includes(pType)) {
              total = parseFloat((boxes * rBox).toFixed(2));
              sqft = 0;
              rSqft = 0;
            } else {
              // 'box'
              boxes = cov > 0 ? parseFloat((sqft / cov).toFixed(2)) : boxes;
              rBox = cov > 0 ? parseFloat((rSqft * cov).toFixed(2)) : rBox;
              total = parseFloat((sqft * rSqft).toFixed(2));
            }

            const baseSqft = parseFloat(item.base_rate_per_sqft) || rSqft;
            const baseBox = parseFloat(item.mrp_price !== undefined ? item.mrp_price : item.base_rate_per_box) || rBox;
            const discPct = parseFloat(item.discount_percent) || 0;
            const discAmt = parseFloat(item.discount_amount) || parseFloat((boxes * baseBox - total).toFixed(2));
            const itemCode = item.item_code || (qType === 'sanitary' ? (item.size || null) : null);
            const itemImage = item.item_image || null;
            const mrpPrice = parseFloat(item.mrp_price) || (pType === 'nos' ? baseBox : 0);
            const itemDesc = item.item_description || item.description || (qType === 'sanitary' ? 'Sanitary Item' : 'Vitrified Tile');
            const encCode = encryptedCodesMap.get(itemDesc.trim()) || null;

            await client.query(
              `INSERT INTO quotation_items (
                quotation_id, area_id, sl_no, description, size, brand,
                product_type, coverage_area, quantity_sqft, base_rate_per_sqft, rate_per_sqft,
                quantity_boxes, base_rate_per_box, rate_per_box, discount_percent, discount_amount, total_amount,
                item_code, item_image, mrp_price, encrypted_code
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
              [
                newQ.id,
                areaId,
                itemSlNo++,
                itemDesc,
                item.size || (qType === 'sanitary' ? (itemCode || 'Nos') : 'Standard'),
                item.brand || (qType === 'sanitary' ? 'Sanitary' : 'AMA Collection'),
                pType,
                cov,
                sqft,
                baseSqft,
                rSqft,
                boxes,
                baseBox,
                rBox,
                discPct,
                discAmt,
                total,
                itemCode,
                itemImage,
                mrpPrice,
                encCode,
              ]
            );

            // Automatically record tile item into catalog for future auto-fill memory
            if (qType !== 'sanitary') {
              const desc = (item.item_description || item.description || '').trim();
              if (desc && desc.length > 1) {
                await client.query(
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
                    last_used_at = CURRENT_TIMESTAMP`,
                  [desc, item.brand || null, item.size || null, pType, cov, baseSqft, rSqft, baseBox, rBox]
                ).catch(() => {});
              }
            }
          }
        }
      }

      await recordAuditLog({
        userId: req.user!.id,
        username: req.user!.username,
        action: 'QUOTATION_CREATED',
        entityType: 'quotation',
        entityId: newQ.id,
        details: { quotation_number: newQ.quotation_number, net_total: newQ.net_total },
        ipAddress: req.ip,
      });

      return newQ;
    });

    broadcast({ type: 'QUOTATION_CREATED', payload: { id: result.id, quotation_number: result.quotation_number } });

    res.status(201).json({ quotation: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Update Quotation (with Optimistic Concurrency Control)
quotationsRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const {
      version,
      quotation_type,
      quotation_date,
      customer_id,
      customer_name,
      customer_phone,
      customer_gstin,
      delivery_address,
      site_location,
      project_name,
      status: reqStatus,
      special_notes,
      discount_percent,
      discount_amount,
      tax_type = 'cgst_sgst',
      assisted_sales_person_id,
      assisted_sales_person_name,
      split_share_type = 'percentage',
      primary_sales_share_percent,
      primary_sales_share_amount,
      assisted_sales_share_percent,
      assisted_sales_share_amount,
      areas = [],
    } = req.body;

    if (version === undefined) {
      res.status(400).json({ error: 'Record version is required for safe concurrent updates' });
      return;
    }

    const updated = await withTransaction(async (client) => {
      // Optimistic concurrency check
      const current = await client.query('SELECT version, status, quotation_type FROM quotations WHERE id = $1', [id]);
      if (current.rows.length === 0) {
        throw new Error('Quotation not found');
      }

      if (current.rows[0].version !== parseInt(version, 10)) {
        const conflictErr: any = new Error(
          'Conflict: This quotation was modified by another user. Please reload the latest changes.'
        );
        conflictErr.statusCode = 409;
        throw conflictErr;
      }

      const qType = (quotation_type || current.rows[0].quotation_type || 'tiles') === 'sanitary' ? 'sanitary' : 'tiles';

      const allItems: any[] = [];
      areas.forEach((a: any) => {
        if (Array.isArray(a.items)) {
          a.items.forEach((it: any) => allItems.push(it));
        }
      });

      const totals = calculateTotals(
        allItems,
        parseFloat(discount_percent) || 0,
        parseFloat(discount_amount) || 0,
        tax_type,
        qType
      );

      // Compute Sales Split Shares
      let finalAssistedId: number | null = null;
      let finalAssistedName: string | null = null;
      let finalSplitType: string | null = null;
      let primaryPct = 100.0;
      let primaryAmt = totals.netTotal;
      let assistedPct = 0.0;
      let assistedAmt = 0.0;

      if (assisted_sales_person_id) {
        finalAssistedId = parseInt(assisted_sales_person_id, 10);
        const assistedUser = await client.query('SELECT full_name FROM users WHERE id = $1', [finalAssistedId]);
        finalAssistedName = assistedUser.rows[0]?.full_name || assisted_sales_person_name || 'Assisted Salesperson';
        finalSplitType = split_share_type === 'amount' ? 'amount' : 'percentage';

        if (finalSplitType === 'amount') {
          assistedAmt = Math.min(totals.netTotal, Math.max(0, parseFloat(assisted_sales_share_amount) || 0));
          primaryAmt = Math.max(0, parseFloat((totals.netTotal - assistedAmt).toFixed(2)));
          primaryPct = totals.netTotal > 0 ? parseFloat(((primaryAmt / totals.netTotal) * 100).toFixed(2)) : 100;
          assistedPct = totals.netTotal > 0 ? parseFloat(((assistedAmt / totals.netTotal) * 100).toFixed(2)) : 0;
        } else {
          assistedPct = Math.min(100, Math.max(0, parseFloat(assisted_sales_share_percent) || 0));
          primaryPct = parseFloat((100 - assistedPct).toFixed(2));
          primaryAmt = parseFloat(((totals.netTotal * primaryPct) / 100).toFixed(2));
          assistedAmt = parseFloat((totals.netTotal - primaryAmt).toFixed(2));
        }
      }

      const nextStatus = reqStatus && ['draft', 'in_review', 'approved', 'closed', 'rejected'].includes(String(reqStatus).toLowerCase())
        ? String(reqStatus).toLowerCase()
        : current.rows[0].status;
      const isNextApproved = ['approved', 'closed'].includes(nextStatus);

      // Update Quotation Header and bump version
      const nextVersion = current.rows[0].version + 1;
      const qRes = await client.query(
        `UPDATE quotations
         SET quotation_date = $1,
             customer_id = $2,
             customer_name = $3,
             customer_phone = $4,
             customer_gstin = $5,
             delivery_address = $6,
             site_location = $7,
             project_name = $8,
             quotation_type = $9,
             assisted_sales_person_id = $10,
             assisted_sales_person_name = $11,
             split_share_type = $12,
             primary_sales_share_percent = $13,
             primary_sales_share_amount = $14,
             assisted_sales_share_percent = $15,
             assisted_sales_share_amount = $16,
             status = $17,
             approved_by_id = CASE WHEN $18 THEN COALESCE(approved_by_id, $19) ELSE approved_by_id END,
             approved_at = CASE WHEN $18 THEN COALESCE(approved_at, NOW()) ELSE approved_at END,
             gross_total = $20,
             discount_percent = $21,
             discount_amount = $22,
             taxable_amount = $23,
             tax_type = $24,
             cgst_rate = $25,
             cgst_amount = $26,
             sgst_rate = $27,
             sgst_amount = $28,
             igst_rate = $29,
             igst_amount = $30,
             round_off = $31,
             net_total = $32,
             special_notes = $33,
             version = $34,
             updated_at = NOW()
         WHERE id = $35 AND version = $36
         RETURNING *`,
        [
          quotation_date,
          customer_id || null,
          customer_name,
          customer_phone,
          customer_gstin || null,
          delivery_address || '',
          site_location || '',
          project_name || '',
          qType,
          finalAssistedId,
          finalAssistedName,
          finalSplitType,
          primaryPct,
          primaryAmt,
          assistedPct,
          assistedAmt,
          nextStatus,
          isNextApproved,
          req.user!.id,
          totals.grossTotal,
          parseFloat(discount_percent) || 0,
          totals.discountAmount,
          totals.taxableAmount,
          tax_type,
          totals.cgstRate,
          totals.cgstAmount,
          totals.sgstRate,
          totals.sgstAmount,
          totals.igstRate,
          totals.igstAmount,
          totals.roundOff,
          totals.netTotal,
          special_notes || '',
          nextVersion,
          id,
          current.rows[0].version,
        ]
      );

      // Re-create areas and items cleanly
      await client.query('DELETE FROM quotation_areas WHERE quotation_id = $1', [id]);

      // Pre-resolve and save encrypted codes for all items
      const allItemNames: string[] = [];
      for (const a of areas) {
        if (Array.isArray(a.items)) {
          for (const it of a.items) {
            const desc = (it.item_description || it.description || '').trim();
            if (desc) allItemNames.push(desc);
          }
        }
      }
      const encryptedCodesMap = await getOrSaveEncryptedProductCodes(allItemNames, (sql, p) => client.query(sql, p).then((r: any) => r.rows));

      let itemSlNo = 1;
      for (let i = 0; i < areas.length; i++) {
        const area = areas[i];
        const areaRes = await client.query(
          `INSERT INTO quotation_areas (quotation_id, area_name, display_order)
           VALUES ($1, $2, $3) RETURNING id`,
          [id, area.area_name || (qType === 'sanitary' ? 'Sanitary Ware' : `Area ${i + 1}`), i + 1]
        );
        const areaId = areaRes.rows[0].id;

        if (Array.isArray(area.items)) {
          for (const item of area.items) {
            let pType = String(item.product_type || (qType === 'sanitary' ? 'nos' : 'box')).toLowerCase();
            const cov = parseFloat(item.coverage_area) || 0;
            let sqft = parseFloat(item.quantity_sqft) || 0;
            let rSqft = parseFloat(item.rate_per_sqft) || 0;
            let boxes = parseFloat(item.quantity !== undefined ? item.quantity : item.quantity_boxes) || 0;
            let rBox = parseFloat(item.discounted_price !== undefined ? item.discounted_price : item.rate_per_box) || 0;
            let total = 0;

            if (qType === 'sanitary') {
              pType = 'nos';
              const mrp = parseFloat(item.mrp_price !== undefined ? item.mrp_price : item.base_rate_per_box) || 0;
              const discPct = parseFloat(item.discount_percent) || 0;
              if (rBox <= 0 && mrp > 0) {
                rBox = parseFloat((mrp * (1 - discPct / 100)).toFixed(2));
              }
              total = parseFloat((boxes * rBox).toFixed(2));
              sqft = 0;
              rSqft = 0;
            } else if (pType === 'sqft') {
              total = parseFloat((sqft * rSqft).toFixed(2));
              boxes = 0;
              rBox = 0;
            } else if (['bags', 'pieces', 'nos'].includes(pType)) {
              total = parseFloat((boxes * rBox).toFixed(2));
              sqft = 0;
              rSqft = 0;
            } else {
              // 'box'
              boxes = cov > 0 ? parseFloat((sqft / cov).toFixed(2)) : boxes;
              rBox = cov > 0 ? parseFloat((rSqft * cov).toFixed(2)) : rBox;
              total = parseFloat((sqft * rSqft).toFixed(2));
            }

            const baseSqft = parseFloat(item.base_rate_per_sqft) || rSqft;
            const baseBox = parseFloat(item.mrp_price !== undefined ? item.mrp_price : item.base_rate_per_box) || rBox;
            const discPct = parseFloat(item.discount_percent) || 0;
            const discAmt = parseFloat(item.discount_amount) || parseFloat((boxes * baseBox - total).toFixed(2));
            const itemCode = item.item_code || (qType === 'sanitary' ? (item.size || null) : null);
            const itemImage = item.item_image || null;
            const mrpPrice = parseFloat(item.mrp_price) || (pType === 'nos' ? baseBox : 0);
            const itemDesc = item.item_description || item.description || (qType === 'sanitary' ? 'Sanitary Item' : 'Tile Item');
            const encCode = encryptedCodesMap.get(itemDesc.trim()) || null;

            await client.query(
              `INSERT INTO quotation_items (
                quotation_id, area_id, sl_no, description, size, brand,
                product_type, coverage_area, quantity_sqft, base_rate_per_sqft, rate_per_sqft,
                quantity_boxes, base_rate_per_box, rate_per_box, discount_percent, discount_amount, total_amount,
                item_code, item_image, mrp_price, encrypted_code
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
              [
                id,
                areaId,
                itemSlNo++,
                itemDesc,
                item.size || (qType === 'sanitary' ? (itemCode || 'Nos') : ''),
                item.brand || (qType === 'sanitary' ? 'Sanitary' : ''),
                pType,
                cov,
                sqft,
                baseSqft,
                rSqft,
                boxes,
                baseBox,
                rBox,
                discPct,
                discAmt,
                total,
                itemCode,
                itemImage,
                mrpPrice,
                encCode,
              ]
            );

            // Automatically record tile item into catalog for future auto-fill memory
            if (qType !== 'sanitary') {
              const desc = (item.item_description || item.description || '').trim();
              if (desc && desc.length > 1) {
                await client.query(
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
                    last_used_at = CURRENT_TIMESTAMP`,
                  [desc, item.brand || null, item.size || null, pType, cov, baseSqft, rSqft, baseBox, rBox]
                ).catch(() => {});
              }
            }
          }
        }
      }

      await recordAuditLog({
        userId: req.user!.id,
        username: req.user!.username,
        action: 'QUOTATION_UPDATED',
        entityType: 'quotation',
        entityId: id,
        details: { version: nextVersion, net_total: totals.netTotal },
        ipAddress: req.ip,
      });

      return qRes.rows[0];
    });

    broadcast({ type: 'QUOTATION_UPDATED', payload: { id, version: updated.version } });

    res.json({ quotation: updated });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// 5. Quotation Status Workflow (Approval / Rejection / In-Review)
quotationsRouter.post('/:id/status', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { status, manager_approval_note } = req.body;

    const validStatuses = ['draft', 'in_review', 'approved', 'rejected', 'closed'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    // Role restrictions: Only Manager & Admin can approve or reject
    if (['approved', 'rejected'].includes(status) && !['admin', 'manager'].includes(req.user!.role)) {
      res.status(403).json({ error: 'Only Managers and Administrators can approve or reject quotations' });
      return;
    }

    const isApproval = status === 'approved';
    const rows = await query(
      `UPDATE quotations
       SET status = $1,
           manager_approval_note = COALESCE($2, manager_approval_note),
           approved_by_id = CASE WHEN $3 THEN $4 ELSE approved_by_id END,
           approved_at = CASE WHEN $3 THEN NOW() ELSE approved_at END,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [status, manager_approval_note || null, isApproval, req.user!.id, id]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Quotation not found' });
      return;
    }

    await recordAuditLog({
      userId: req.user!.id,
      username: req.user!.username,
      action: `QUOTATION_STATUS_${status.toUpperCase()}`,
      entityType: 'quotation',
      entityId: id,
      details: { status, manager_approval_note },
      ipAddress: req.ip,
    });

    broadcast({
      type: 'QUOTATION_STATUS_CHANGED',
      payload: { id, status, quotation_number: rows[0].quotation_number },
    });

    res.json({ quotation: rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Delete All Quotations (Admin & Accounts only)
quotationsRouter.delete('/all', requireRole(['admin', 'accounts', 'accountant']), async (req: Request, res: Response) => {
  try {
    await query('DELETE FROM quotation_items');
    await query('DELETE FROM quotation_areas');
    await query('DELETE FROM payments');
    await query('DELETE FROM quotations');

    await recordAuditLog({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'ALL_QUOTATIONS_DELETED',
      entityType: 'quotation',
      details: { message: 'All quotations removed from system' },
      ipAddress: req.ip,
    });

    broadcast({ type: 'QUOTATION_UPDATED', payload: { allDeleted: true } });

    res.json({ message: 'All quotations deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Delete Single Quotation
quotationsRouter.delete('/:id', requireRole(['admin', 'manager', 'accounts']), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);

    const qRows = await query('SELECT status, quotation_number FROM quotations WHERE id = $1', [id]);
    if (qRows.length === 0) {
      res.status(404).json({ error: 'Quotation not found' });
      return;
    }

    const isPrivileged = ['admin', 'accounts'].includes(req.user!.role);
    if (!['draft', 'rejected'].includes(qRows[0].status) && !isPrivileged) {
      res.status(400).json({ error: 'Only draft or rejected quotations can be deleted' });
      return;
    }

    await query('DELETE FROM quotation_items WHERE quotation_id = $1', [id]);
    await query('DELETE FROM quotation_areas WHERE quotation_id = $1', [id]);
    await query('DELETE FROM payments WHERE quotation_id = $1', [id]);
    await query('DELETE FROM quotations WHERE id = $1', [id]);

    await recordAuditLog({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'QUOTATION_DELETED',
      entityType: 'quotation',
      entityId: id,
      details: { quotation_number: qRows[0].quotation_number },
      ipAddress: req.ip,
    });

    broadcast({ type: 'QUOTATION_UPDATED', payload: { id, deleted: true } });

    res.json({ message: 'Quotation deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

