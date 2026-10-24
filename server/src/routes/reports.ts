import { Router, Request, Response } from 'express';
import { query } from '../db/connection';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth';
import * as XLSX from 'xlsx';
import { buildEncryptedProductMap } from '../utils/encryptedCode';

export const reportsRouter = Router();

// Export Quotations as XLSX or CSV (supports optional auth or query token)
reportsRouter.get('/quotations/export', optionalAuthenticateToken, async (req: Request, res: Response) => {
  try {
    const { format = 'xlsx', status, start_date, end_date, sales_person_id, search, encrypted, itemized } = req.query;

    const whereClauses = ['1=1'];
    const params: any[] = [];
    let idx = 1;

    const targetSpId = req.user?.role === 'salesperson' ? req.user.id : (sales_person_id ? parseInt(sales_person_id as string, 10) : null);
    if (targetSpId) {
      whereClauses.push(`(q.sales_person_id = $${idx} OR q.assisted_sales_person_id = $${idx})`);
      params.push(targetSpId);
      idx++;
    }

    if (status) {
      const st = String(status).trim().toLowerCase();
      if (st === 'not_closed' || st === 'open') {
        whereClauses.push(`q.status IN ('draft', 'in_review', 'approved')`);
      } else if (st === 'closed') {
        whereClauses.push(`q.status = 'closed'`);
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

    if (start_date) {
      whereClauses.push(`q.quotation_date >= $${idx++}`);
      params.push(start_date);
    }
    if (end_date) {
      whereClauses.push(`q.quotation_date <= $${idx++}`);
      params.push(end_date);
    }

    const isEncrypted = encrypted === 'true' || encrypted === '1';
    const isItemized = itemized === 'true' || itemized === '1';

    let rows: any[] = [];

    if (isItemized) {
      const itemRows = await query(`
        SELECT
          q.quotation_number as "Quotation No",
          TO_CHAR(q.quotation_date, 'YYYY-MM-DD') as "Date",
          q.customer_name as "Customer",
          q.sales_person_name as "Salesperson",
          COALESCE(q.assisted_sales_person_name, '') as "Assisted By",
          q.status as "Status",
          qa.area_name as "Area / Room",
          qi.sl_no as "Item No",
          qi.description as "Product Description",
          qi.brand as "Brand",
          qi.size as "Size",
          qi.product_type as "Product Type",
          qi.quantity_sqft as "Sqft",
          qi.rate_per_sqft as "Rate/Sqft",
          qi.quantity_boxes as "Boxes/Qty",
          qi.rate_per_box as "Rate/Unit",
          qi.total_amount as "Item Total (INR)"
        FROM quotation_items qi
        JOIN quotation_areas qa ON qa.id = qi.area_id
        JOIN quotations q ON q.id = qa.quotation_id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY q.quotation_date DESC, q.id DESC, qa.display_order ASC, qi.sl_no ASC
      `, params);

      if (isEncrypted) {
        // Deterministically mask product descriptions and omit brand
        const qGroups = new Map<string, Array<{ description: string }>>();
        for (const it of itemRows) {
          const qNo = it["Quotation No"];
          if (!qGroups.has(qNo)) qGroups.set(qNo, []);
          qGroups.get(qNo)!.push({ description: it["Product Description"] });
        }
        const qMaps = new Map<string, Map<string, string>>();
        for (const [qNo, items] of qGroups.entries()) {
          qMaps.set(qNo, buildEncryptedProductMap(qNo, items));
        }

        rows = itemRows.map((it: any) => {
          const qNo = it["Quotation No"];
          const masked = qMaps.get(qNo)?.get(String(it["Product Description"] || '').trim()) || `${it["Product Description"]}-AMA`;
          return {
            "Quotation No": it["Quotation No"],
            "Date": it["Date"],
            "Customer": it["Customer"],
            "Salesperson": it["Salesperson"],
            "Status": it["Status"],
            "Area / Room": it["Area / Room"],
            "Item No": it["Item No"],
            "Encrypted Product Code": masked,
            "Size": it["Size"],
            "Product Type": it["Product Type"],
            "Sqft": it["Sqft"],
            "Rate/Sqft": it["Rate/Sqft"],
            "Boxes/Qty": it["Boxes/Qty"],
            "Rate/Unit": it["Rate/Unit"],
            "Item Total (INR)": it["Item Total (INR)"],
          };
        });
      } else {
        rows = itemRows;
      }
    } else {
      const regRows = await query(`
        SELECT
          q.quotation_number as "Quotation No",
          TO_CHAR(q.quotation_date, 'YYYY-MM-DD') as "Date",
          q.customer_name as "Customer",
          q.customer_phone as "Phone",
          q.project_name as "Project",
          q.sales_person_name as "Salesperson",
          COALESCE(q.assisted_sales_person_name, '') as "Assisted By",
          q.status as "Status",
          q.gross_total as "Gross Total (INR)",
          q.discount_amount as "Discount (INR)",
          q.taxable_amount as "Taxable (INR)",
          q.net_total as "Net Total (INR)",
          COALESCE(p.total_paid, 0) as "Paid (INR)",
          (q.net_total - COALESCE(p.total_paid, 0)) as "Balance Due (INR)",
          ${targetSpId ? `
            CASE
              WHEN q.assisted_sales_person_id = ${targetSpId} THEN 'Assisted'
              WHEN q.sales_person_id = ${targetSpId} THEN 'Primary'
              ELSE 'Sales Associate'
            END as "Salesperson Role",
            CASE
              WHEN q.assisted_sales_person_id = ${targetSpId} THEN COALESCE(q.assisted_sales_share_percent, 50)
              ELSE COALESCE(q.primary_sales_share_percent, 100)
            END as "Sales Share %",
            CASE
              WHEN q.assisted_sales_person_id = ${targetSpId} THEN COALESCE(q.assisted_sales_share_amount, ROUND((q.net_total * COALESCE(q.assisted_sales_share_percent, 50) / 100.0)::numeric, 2))
              ELSE COALESCE(q.primary_sales_share_amount, q.net_total)
            END as "Sales Credit (INR)"
          ` : `
            COALESCE(q.primary_sales_share_percent, 100) as "Primary Share %",
            COALESCE(q.primary_sales_share_amount, q.net_total) as "Primary Credit (INR)",
            COALESCE(q.assisted_sales_share_percent, 0) as "Assisted Share %",
            COALESCE(q.assisted_sales_share_amount, 0) as "Assisted Credit (INR)"
          `}
        FROM quotations q
        LEFT JOIN (
          SELECT quotation_id, SUM(amount) as total_paid FROM payments WHERE status = 'Cleared' GROUP BY quotation_id
        ) p ON p.quotation_id = q.id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY q.quotation_date DESC, q.id DESC
      `, params);

      rows = regRows;
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, isEncrypted ? 'Encrypted Quotes' : 'Quotations');

    const statusSuffix = status ? `_${status}` : '';
    const encSuffix = isEncrypted ? '_Encrypted' : '';
    const dateSuffix = new Date().toISOString().split('T')[0];
    const outFilename = `Quotations${statusSuffix}${encSuffix}_${dateSuffix}.${format}`;

    if (format === 'csv') {
      const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${outFilename}"`);
      res.send(csvOutput);
    } else {
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${outFilename}"`);
      res.send(buffer);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Salesperson Quotation Summary & Breakdown Report (JSON for dashboard/charts)
reportsRouter.get('/salespersons/summary', optionalAuthenticateToken, async (req: Request, res: Response) => {
  try {
    const { start_date, end_date, sales_person_id } = req.query;
    const targetSpId = req.user?.role === 'salesperson' ? req.user.id : (sales_person_id ? parseInt(sales_person_id as string, 10) : null);

    const dateClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (start_date) {
      dateClauses.push(`q.quotation_date >= $${idx++}`);
      params.push(start_date);
    }
    if (end_date) {
      dateClauses.push(`q.quotation_date <= $${idx++}`);
      params.push(end_date);
    }

    const dateFilter = dateClauses.length > 0 ? `AND ${dateClauses.join(' AND ')}` : '';
    let userFilter = '';
    if (targetSpId) {
      userFilter = `AND u.id = $${idx++}`;
      params.push(targetSpId);
    }

    const rows = await query(`
      SELECT
        u.id as user_id,
        u.full_name as sales_person_name,
        u.role,
        u.email,
        u.phone,
        COALESCE(u.monthly_target, 0) as monthly_target,
        COUNT(DISTINCT q.id) as total_quotations,
        COUNT(DISTINCT CASE WHEN LOWER(q.status) = 'closed' THEN q.id END) as closed_quotations,
        COUNT(DISTINCT CASE WHEN LOWER(q.status) IN ('draft', 'in_review', 'approved') THEN q.id END) as pipeline_quotations,
        COUNT(DISTINCT CASE WHEN LOWER(q.status) = 'rejected' THEN q.id END) as rejected_quotations,
        COALESCE(SUM(
          CASE
            WHEN q.sales_person_id = u.id THEN
              CASE
                WHEN q.assisted_sales_person_id IS NOT NULL AND q.primary_sales_share_amount > 0 THEN q.primary_sales_share_amount
                WHEN q.assisted_sales_person_id IS NOT NULL AND q.primary_sales_share_percent > 0 THEN ROUND((q.net_total * q.primary_sales_share_percent / 100.0)::numeric, 2)
                ELSE q.net_total
              END
            WHEN q.assisted_sales_person_id = u.id THEN
              CASE
                WHEN q.assisted_sales_share_amount > 0 THEN q.assisted_sales_share_amount
                WHEN q.assisted_sales_share_percent > 0 THEN ROUND((q.net_total * q.assisted_sales_share_percent / 100.0)::numeric, 2)
                ELSE 0
              END
            ELSE 0
          END
        ), 0) as total_value,
        COALESCE(SUM(
          CASE
            WHEN LOWER(q.status) = 'closed' THEN
              CASE
                WHEN q.sales_person_id = u.id THEN
                  CASE
                    WHEN q.assisted_sales_person_id IS NOT NULL AND q.primary_sales_share_amount > 0 THEN q.primary_sales_share_amount
                    WHEN q.assisted_sales_person_id IS NOT NULL AND q.primary_sales_share_percent > 0 THEN ROUND((q.net_total * q.primary_sales_share_percent / 100.0)::numeric, 2)
                    ELSE q.net_total
                  END
                WHEN q.assisted_sales_person_id = u.id THEN
                  CASE
                    WHEN q.assisted_sales_share_amount > 0 THEN q.assisted_sales_share_amount
                    WHEN q.assisted_sales_share_percent > 0 THEN ROUND((q.net_total * q.assisted_sales_share_percent / 100.0)::numeric, 2)
                    ELSE 0
                  END
                ELSE 0
              END
            ELSE 0
          END
        ), 0) as closed_value,
        COALESCE(SUM(
          CASE
            WHEN LOWER(q.status) IN ('draft', 'in_review', 'approved') THEN
              CASE
                WHEN q.sales_person_id = u.id THEN
                  CASE
                    WHEN q.assisted_sales_person_id IS NOT NULL AND q.primary_sales_share_amount > 0 THEN q.primary_sales_share_amount
                    WHEN q.assisted_sales_person_id IS NOT NULL AND q.primary_sales_share_percent > 0 THEN ROUND((q.net_total * q.primary_sales_share_percent / 100.0)::numeric, 2)
                    ELSE q.net_total
                  END
                WHEN q.assisted_sales_person_id = u.id THEN
                  CASE
                    WHEN q.assisted_sales_share_amount > 0 THEN q.assisted_sales_share_amount
                    WHEN q.assisted_sales_share_percent > 0 THEN ROUND((q.net_total * q.assisted_sales_share_percent / 100.0)::numeric, 2)
                    ELSE 0
                  END
                ELSE 0
              END
            ELSE 0
          END
        ), 0) as pipeline_value,
        COUNT(DISTINCT CASE WHEN q.sales_person_id = u.id THEN q.id END) as primary_count,
        COUNT(DISTINCT CASE WHEN q.assisted_sales_person_id = u.id THEN q.id END) as assisted_count
      FROM users u
      LEFT JOIN quotations q ON (q.sales_person_id = u.id OR q.assisted_sales_person_id = u.id) ${dateFilter}
      WHERE u.is_active = true ${userFilter}
      GROUP BY u.id, u.full_name, u.role, u.email, u.phone, u.monthly_target
      ORDER BY closed_value DESC, total_value DESC, u.full_name ASC
    `, params);

    const summary = rows.map((r: any) => {
      const totQ = parseInt(r.total_quotations, 10) || 0;
      const closedQ = parseInt(r.closed_quotations, 10) || 0;
      const closedVal = parseFloat(r.closed_value) || 0;
      const targetVal = parseFloat(r.monthly_target) || 0;
      return {
        ...r,
        total_quotations: totQ,
        closed_quotations: closedQ,
        pipeline_quotations: parseInt(r.pipeline_quotations, 10) || 0,
        rejected_quotations: parseInt(r.rejected_quotations, 10) || 0,
        total_value: parseFloat(r.total_value) || 0,
        closed_value: closedVal,
        pipeline_value: parseFloat(r.pipeline_value) || 0,
        primary_count: parseInt(r.primary_count, 10) || 0,
        assisted_count: parseInt(r.assisted_count, 10) || 0,
        monthly_target: targetVal,
        win_rate: totQ > 0 ? parseFloat(((closedQ / totQ) * 100).toFixed(1)) : 0,
        target_achievement_percent: targetVal > 0 ? parseFloat(((closedVal / targetVal) * 100).toFixed(1)) : 0,
      };
    });

    res.json({ success: true, summary });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Export Salesperson Performance Summary to XLSX or CSV
reportsRouter.get('/salespersons/export', optionalAuthenticateToken, async (req: Request, res: Response) => {
  try {
    const { format = 'xlsx', start_date, end_date } = req.query;

    const dateClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (start_date) {
      dateClauses.push(`q.quotation_date >= $${idx++}`);
      params.push(start_date);
    }
    if (end_date) {
      dateClauses.push(`q.quotation_date <= $${idx++}`);
      params.push(end_date);
    }

    const dateFilter = dateClauses.length > 0 ? `AND ${dateClauses.join(' AND ')}` : '';

    const rows = await query(`
      SELECT
        u.full_name as "Salesperson",
        u.role as "Role",
        COALESCE(u.monthly_target, 0) as "Monthly Target (INR)",
        COUNT(DISTINCT q.id) as "Total Quotes",
        COUNT(DISTINCT CASE WHEN LOWER(q.status) = 'closed' THEN q.id END) as "Closed Quotes",
        COUNT(DISTINCT CASE WHEN LOWER(q.status) IN ('draft', 'in_review', 'approved') THEN q.id END) as "Pipeline Quotes",
        COALESCE(SUM(
          CASE
            WHEN LOWER(q.status) = 'closed' THEN
              CASE
                WHEN q.sales_person_id = u.id THEN
                  CASE
                    WHEN q.assisted_sales_person_id IS NOT NULL AND q.primary_sales_share_amount > 0 THEN q.primary_sales_share_amount
                    WHEN q.assisted_sales_person_id IS NOT NULL AND q.primary_sales_share_percent > 0 THEN ROUND((q.net_total * q.primary_sales_share_percent / 100.0)::numeric, 2)
                    ELSE q.net_total
                  END
                WHEN q.assisted_sales_person_id = u.id THEN
                  CASE
                    WHEN q.assisted_sales_share_amount > 0 THEN q.assisted_sales_share_amount
                    WHEN q.assisted_sales_share_percent > 0 THEN ROUND((q.net_total * q.assisted_sales_share_percent / 100.0)::numeric, 2)
                    ELSE 0
                  END
                ELSE 0
              END
            ELSE 0
          END
        ), 0) as "Closed Revenue (INR)",
        COALESCE(SUM(
          CASE
            WHEN LOWER(q.status) IN ('draft', 'in_review', 'approved') THEN
              CASE
                WHEN q.sales_person_id = u.id THEN
                  CASE
                    WHEN q.assisted_sales_person_id IS NOT NULL AND q.primary_sales_share_amount > 0 THEN q.primary_sales_share_amount
                    WHEN q.assisted_sales_person_id IS NOT NULL AND q.primary_sales_share_percent > 0 THEN ROUND((q.net_total * q.primary_sales_share_percent / 100.0)::numeric, 2)
                    ELSE q.net_total
                  END
                WHEN q.assisted_sales_person_id = u.id THEN
                  CASE
                    WHEN q.assisted_sales_share_amount > 0 THEN q.assisted_sales_share_amount
                    WHEN q.assisted_sales_share_percent > 0 THEN ROUND((q.net_total * q.assisted_sales_share_percent / 100.0)::numeric, 2)
                    ELSE 0
                  END
                ELSE 0
              END
            ELSE 0
          END
        ), 0) as "Pipeline Value (INR)",
        COALESCE(SUM(
          CASE
            WHEN q.sales_person_id = u.id THEN
              CASE
                WHEN q.assisted_sales_person_id IS NOT NULL AND q.primary_sales_share_amount > 0 THEN q.primary_sales_share_amount
                WHEN q.assisted_sales_person_id IS NOT NULL AND q.primary_sales_share_percent > 0 THEN ROUND((q.net_total * q.primary_sales_share_percent / 100.0)::numeric, 2)
                ELSE q.net_total
              END
            WHEN q.assisted_sales_person_id = u.id THEN
              CASE
                WHEN q.assisted_sales_share_amount > 0 THEN q.assisted_sales_share_amount
                WHEN q.assisted_sales_share_percent > 0 THEN ROUND((q.net_total * q.assisted_sales_share_percent / 100.0)::numeric, 2)
                ELSE 0
              END
            ELSE 0
          END
        ), 0) as "Total Quoted Value (INR)"
      FROM users u
      LEFT JOIN quotations q ON (q.sales_person_id = u.id OR q.assisted_sales_person_id = u.id) ${dateFilter}
      WHERE u.is_active = true
      GROUP BY u.id, u.full_name, u.role, u.monthly_target
      ORDER BY "Closed Revenue (INR)" DESC, "Total Quoted Value (INR)" DESC
    `, params);

    // Calculate win rates
    const formatted = rows.map((r: any) => {
      const tot = parseInt(r["Total Quotes"], 10) || 0;
      const closed = parseInt(r["Closed Quotes"], 10) || 0;
      const winRate = tot > 0 ? `${((closed / tot) * 100).toFixed(1)}%` : '0%';
      const tgt = parseFloat(r["Monthly Target (INR)"]) || 0;
      const clsdVal = parseFloat(r["Closed Revenue (INR)"]) || 0;
      const ach = tgt > 0 ? `${((clsdVal / tgt) * 100).toFixed(1)}%` : '0%';
      return {
        ...r,
        "Win Rate": winRate,
        "Target Achievement": ach,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(formatted);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Team Performance');

    const dateSuffix = new Date().toISOString().split('T')[0];
    const outFilename = `Sales_Team_Performance_${dateSuffix}.${format}`;

    if (format === 'csv') {
      const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${outFilename}"`);
      res.send(csvOutput);
    } else {
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${outFilename}"`);
      res.send(buffer);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Export Payments as XLSX or CSV
reportsRouter.get('/payments/export', optionalAuthenticateToken, async (req: Request, res: Response) => {
  try {
    const { format = 'xlsx', start_date, end_date } = req.query;

    const whereClauses = ['1=1'];
    const params: any[] = [];
    let idx = 1;

    if (start_date) {
      whereClauses.push(`p.payment_date >= $${idx++}`);
      params.push(start_date);
    }
    if (end_date) {
      whereClauses.push(`p.payment_date <= $${idx++}`);
      params.push(end_date);
    }

    const rows = await query(`
      SELECT
        p.payment_number as "Receipt No",
        p.payment_date as "Date",
        q.quotation_number as "Quotation No",
        q.customer_name as "Customer",
        p.amount as "Amount (INR)",
        p.payment_mode as "Payment Mode",
        p.reference_number as "Ref / Txn No",
        p.status as "Status",
        u.full_name as "Recorded By",
        p.notes as "Notes"
      FROM payments p
      JOIN quotations q ON q.id = p.quotation_id
      LEFT JOIN users u ON u.id = p.recorded_by_id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY p.payment_date DESC
    `, params);

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Payments');

    if (format === 'csv') {
      const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="Payments_Export.csv"');
      res.send(csvOutput);
    } else {
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Payments_Export.xlsx"');
      res.send(buffer);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
