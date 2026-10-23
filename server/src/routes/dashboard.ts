import { Router, Request, Response } from 'express';
import { query } from '../db/connection';
import { authenticateToken } from '../middleware/auth';

export const dashboardRouter = Router();

dashboardRouter.use(authenticateToken);

dashboardRouter.get('/summary', async (req: Request, res: Response) => {
  try {
    const isSalesperson = req.user!.role === 'salesperson';
    const filterUser = isSalesperson ? `WHERE sales_person_id = ${req.user!.id}` : '';

    // Status breakdown
    const statusCounts = await query(`
      SELECT status, count(*) as count, COALESCE(sum(net_total), 0) as total_val
      FROM quotations
      ${filterUser}
      GROUP BY status
    `);

    // Financial totals
    const financialTotals = await query(`
      SELECT
        COALESCE(SUM(q.net_total), 0) as total_quoted,
        COALESCE(SUM(CASE WHEN q.status IN ('approved', 'closed') THEN q.net_total ELSE 0 END), 0) as approved_revenue
      FROM quotations q
      ${filterUser}
    `);

    // Payments collected
    const paymentTotals = await query(`
      SELECT
        COALESCE(SUM(p.amount), 0) as total_collected
      FROM payments p
      JOIN quotations q ON q.id = p.quotation_id
      WHERE p.status = 'Cleared' ${isSalesperson ? `AND q.sales_person_id = ${req.user!.id}` : ''}
    `);

    // Total outstanding on approved/closed quotations
    const approvedRevenue = parseFloat(financialTotals[0]?.approved_revenue || '0');
    const totalCollected = parseFloat(paymentTotals[0]?.total_collected || '0');
    const totalOutstanding = Math.max(0, approvedRevenue - totalCollected);

    // Recent 10 quotations
    const recentQuotations = await query(`
      SELECT id, quotation_number, quotation_date, customer_name, sales_person_name, status, net_total
      FROM quotations
      ${filterUser}
      ORDER BY created_at DESC
      LIMIT 10
    `);

    // Leaderboard (for managers/admins/accounts)
    let leaderboard: any[] = [];
    if (!isSalesperson) {
      leaderboard = await query(`
        SELECT u.id, u.full_name,
               count(q.id) as total_quotations,
               COALESCE(SUM(CASE WHEN q.status IN ('approved', 'closed') THEN q.net_total ELSE 0 END), 0) as sales_achieved
        FROM users u
        LEFT JOIN quotations q ON q.sales_person_id = u.id
        WHERE u.role IN ('salesperson', 'manager') AND u.is_active = true
        GROUP BY u.id, u.full_name
        ORDER BY sales_achieved DESC
        LIMIT 5
      `);
    }

    // Monthly breakdown (last 6 months)
    const monthlyTrend = await query(`
      SELECT
        TO_CHAR(quotation_date, 'YYYY-MM') as month,
        count(*) as quotation_count,
        COALESCE(SUM(CASE WHEN status IN ('approved', 'closed') THEN net_total ELSE 0 END), 0) as closed_amount
      FROM quotations
      ${filterUser ? `${filterUser} AND` : 'WHERE'} quotation_date >= NOW() - INTERVAL '6 months'
      GROUP BY TO_CHAR(quotation_date, 'YYYY-MM')
      ORDER BY month ASC
    `);

    res.json({
      statusCounts,
      financials: {
        totalQuoted: parseFloat(financialTotals[0]?.total_quoted || '0'),
        approvedRevenue,
        totalCollected,
        totalOutstanding,
      },
      recentQuotations,
      leaderboard,
      monthlyTrend,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
