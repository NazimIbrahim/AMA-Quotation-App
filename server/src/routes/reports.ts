import { Router, Request, Response } from 'express';
import { query } from '../db/connection';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth';
import * as XLSX from 'xlsx';

export const reportsRouter = Router();

// Export Quotations as XLSX or CSV (supports optional auth or query token)
reportsRouter.get('/quotations/export', optionalAuthenticateToken, async (req: Request, res: Response) => {
  try {
    const { format = 'xlsx', status, start_date, end_date } = req.query;

    const whereClauses = ['1=1'];
    const params: any[] = [];
    let idx = 1;

    if (req.user?.role === 'salesperson') {
      whereClauses.push(`q.sales_person_id = $${idx++}`);
      params.push(req.user.id);
    }
    if (status) {
      whereClauses.push(`q.status = $${idx++}`);
      params.push(status);
    }
    if (start_date) {
      whereClauses.push(`q.quotation_date >= $${idx++}`);
      params.push(start_date);
    }
    if (end_date) {
      whereClauses.push(`q.quotation_date <= $${idx++}`);
      params.push(end_date);
    }

    const rows = await query(`
      SELECT
        q.quotation_number as "Quotation No",
        q.quotation_date as "Date",
        q.customer_name as "Customer",
        q.customer_phone as "Phone",
        q.project_name as "Project",
        q.sales_person_name as "Salesperson",
        q.status as "Status",
        q.gross_total as "Gross Total (INR)",
        q.discount_amount as "Discount (INR)",
        q.taxable_amount as "Taxable (INR)",
        q.net_total as "Net Total (INR)",
        COALESCE(p.total_paid, 0) as "Paid (INR)",
        (q.net_total - COALESCE(p.total_paid, 0)) as "Balance Due (INR)"
      FROM quotations q
      LEFT JOIN (
        SELECT quotation_id, SUM(amount) as total_paid FROM payments WHERE status = 'Cleared' GROUP BY quotation_id
      ) p ON p.quotation_id = q.id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY q.quotation_date DESC
    `, params);

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Quotations');

    if (format === 'csv') {
      const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="Quotations_Export.csv"');
      res.send(csvOutput);
    } else {
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Quotations_Export.xlsx"');
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
