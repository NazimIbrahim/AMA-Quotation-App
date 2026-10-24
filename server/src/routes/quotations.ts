import { Router, Request, Response } from 'express';
import { query, withTransaction } from '../db/connection';
import { authenticateToken, optionalAuthenticateToken, requireRole } from '../middleware/auth';
import { generateNextQuotationNumber } from '../utils/quotationNumber';
import { generateQuotationPdf } from '../utils/pdfGenerator';
import { recordAuditLog } from '../utils/audit';
import { broadcast } from '../ws';

export const quotationsRouter = Router();

// Stream PDF Quotation (accessible directly via browser tab, print window, or download with optional token)
quotationsRouter.get('/:id/pdf', optionalAuthenticateToken, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);

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
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="Quotation_${quotation.quotation_number}.pdf"`
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
    const salesPersonId = req.query.sales_person_id ? parseInt(req.query.sales_person_id as string, 10) : null;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    const whereClauses: string[] = ['1=1'];
    const params: any[] = [];
    let idx = 1;

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
      whereClauses.push(`q.status = $${idx++}`);
      params.push(status);
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

    // Fetch Items
    const items = await query(
      `SELECT * FROM quotation_items WHERE quotation_id = $1 ORDER BY sl_no ASC, id ASC`,
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

// Helper: Calculate Totals on Server
function calculateTotals(items: any[], discountPercent: number, discountAmount: number, taxType: string) {
  let grossTotal = 0;
  for (const it of items) {
    const qtySqft = parseFloat(it.quantity_sqft) || 0;
    const rateSqft = parseFloat(it.rate_per_sqft) || 0;
    const total = parseFloat((qtySqft * rateSqft).toFixed(2));
    it.total_amount = total;
    grossTotal += total;
  }
  grossTotal = parseFloat(grossTotal.toFixed(2));

  let finalDiscount = typeof discountAmount === 'number' ? discountAmount : (parseFloat(discountAmount) || 0);
  if (discountPercent > 0 && !finalDiscount) {
    finalDiscount = parseFloat(((grossTotal * discountPercent) / 100).toFixed(2));
  }

  const taxableAmount = Math.max(0, parseFloat((grossTotal - finalDiscount).toFixed(2)));

  let cgstRate = 0, cgstAmount = 0, sgstRate = 0, sgstAmount = 0, igstRate = 0, igstAmount = 0;
  if (taxType === 'cgst_sgst') {
    cgstRate = 9.0;
    sgstRate = 9.0;
    cgstAmount = parseFloat(((taxableAmount * cgstRate) / 100).toFixed(2));
    sgstAmount = parseFloat(((taxableAmount * sgstRate) / 100).toFixed(2));
  } else if (taxType === 'igst') {
    igstRate = 18.0;
    igstAmount = parseFloat(((taxableAmount * igstRate) / 100).toFixed(2));
  }

  const subTotalWithTax = taxableAmount + cgstAmount + sgstAmount + igstAmount;
  const roundedNet = Math.round(subTotalWithTax);
  const roundOff = parseFloat((roundedNet - subTotalWithTax).toFixed(2));

  return {
    grossTotal,
    discountAmount: finalDiscount,
    taxableAmount,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate,
    igstAmount,
    roundOff,
    netTotal: roundedNet,
  };
}

// 3. Create Quotation (Transactional)
quotationsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
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
      tax_type
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
          project_name, status, approved_by_id, approved_at, gross_total, discount_percent,
          discount_amount, taxable_amount, tax_type, cgst_rate, cgst_amount,
          sgst_rate, sgst_amount, igst_rate, igst_amount, round_off, net_total,
          special_notes, version
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8, $9,
          $10, $11, $12,
          $13, $14, $15,
          $16, $17,
          $18, $19, $20, $21, $22, $23,
          $24, $25, $26, $27, $28,
          $29, $30, $31, $32, $33, $34,
          $35, 1
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

      for (let i = 0; i < areas.length; i++) {
        const area = areas[i];
        const areaRes = await client.query(
          `INSERT INTO quotation_areas (quotation_id, area_name, display_order)
           VALUES ($1, $2, $3) RETURNING id`,
          [newQ.id, area.area_name || `Area ${i + 1}`, i + 1]
        );
        const areaId = areaRes.rows[0].id;

        if (Array.isArray(area.items)) {
          for (const item of area.items) {
            const cov = parseFloat(item.coverage_area) || 0;
            const sqft = parseFloat(item.quantity_sqft) || 0;
            const rSqft = parseFloat(item.rate_per_sqft) || 0;
            const boxes = cov > 0 ? parseFloat((sqft / cov).toFixed(2)) : parseFloat(item.quantity_boxes) || 0;
            const rBox = cov > 0 ? parseFloat((rSqft * cov).toFixed(2)) : parseFloat(item.rate_per_box) || 0;
            const total = parseFloat((sqft * rSqft).toFixed(2));

            await client.query(
              `INSERT INTO quotation_items (
                quotation_id, area_id, sl_no, description, size, brand,
                coverage_area, quantity_sqft, rate_per_sqft, quantity_boxes, rate_per_box, total_amount
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
              [
                newQ.id,
                areaId,
                itemSlNo++,
                item.description || 'Vitrified Tile',
                item.size || 'Standard',
                item.brand || 'AMA Collection',
                cov,
                sqft,
                rSqft,
                boxes,
                rBox,
                total,
              ]
            );
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
      tax_type
    );

    const updated = await withTransaction(async (client) => {
      // Optimistic concurrency check
      const current = await client.query('SELECT version, status FROM quotations WHERE id = $1', [id]);
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
             assisted_sales_person_id = $9,
             assisted_sales_person_name = $10,
             split_share_type = $11,
             primary_sales_share_percent = $12,
             primary_sales_share_amount = $13,
             assisted_sales_share_percent = $14,
             assisted_sales_share_amount = $15,
             status = $16,
             approved_by_id = CASE WHEN $17 THEN COALESCE(approved_by_id, $18) ELSE approved_by_id END,
             approved_at = CASE WHEN $17 THEN COALESCE(approved_at, NOW()) ELSE approved_at END,
             gross_total = $19,
             discount_percent = $20,
             discount_amount = $21,
             taxable_amount = $22,
             tax_type = $23,
             cgst_rate = $24,
             cgst_amount = $25,
             sgst_rate = $26,
             sgst_amount = $27,
             igst_rate = $28,
             igst_amount = $29,
             round_off = $30,
             net_total = $31,
             special_notes = $32,
             version = $33,
             updated_at = NOW()
         WHERE id = $34 AND version = $35
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

      let itemSlNo = 1;
      for (let i = 0; i < areas.length; i++) {
        const area = areas[i];
        const areaRes = await client.query(
          `INSERT INTO quotation_areas (quotation_id, area_name, display_order)
           VALUES ($1, $2, $3) RETURNING id`,
          [id, area.area_name || `Area ${i + 1}`, i + 1]
        );
        const areaId = areaRes.rows[0].id;

        if (Array.isArray(area.items)) {
          for (const item of area.items) {
            const cov = parseFloat(item.coverage_area) || 0;
            const sqft = parseFloat(item.quantity_sqft) || 0;
            const rSqft = parseFloat(item.rate_per_sqft) || 0;
            const boxes = cov > 0 ? parseFloat((sqft / cov).toFixed(2)) : parseFloat(item.quantity_boxes) || 0;
            const rBox = cov > 0 ? parseFloat((rSqft * cov).toFixed(2)) : parseFloat(item.rate_per_box) || 0;
            const total = parseFloat((sqft * rSqft).toFixed(2));

            await client.query(
              `INSERT INTO quotation_items (
                quotation_id, area_id, sl_no, description, size, brand,
                coverage_area, quantity_sqft, rate_per_sqft, quantity_boxes, rate_per_box, total_amount
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
              [
                id,
                areaId,
                itemSlNo++,
                item.description || 'Tile Item',
                item.size || '',
                item.brand || '',
                cov,
                sqft,
                rSqft,
                boxes,
                rBox,
                total,
              ]
            );
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

// 6. Delete Quotation (Draft or Rejected only)
quotationsRouter.delete('/:id', requireRole(['admin', 'manager']), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);

    const qRows = await query('SELECT status, quotation_number FROM quotations WHERE id = $1', [id]);
    if (qRows.length === 0) {
      res.status(404).json({ error: 'Quotation not found' });
      return;
    }

    if (!['draft', 'rejected'].includes(qRows[0].status) && req.user!.role !== 'admin') {
      res.status(400).json({ error: 'Only draft or rejected quotations can be deleted' });
      return;
    }

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

