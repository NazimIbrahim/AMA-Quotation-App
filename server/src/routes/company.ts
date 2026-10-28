import { Router, Request, Response } from 'express';
import { query, getLastDbError } from '../db/connection';
import { authenticateToken, requireRole } from '../middleware/auth';
import { recordAuditLog } from '../utils/audit';
import { broadcast } from '../ws';

export const companyRouter = Router();

// Public / Authenticated read
companyRouter.get('/', async (req: Request, res: Response) => {
  try {
    const rows = await query('SELECT * FROM company_settings LIMIT 1');
    if (rows.length === 0) {
      res.status(404).json({ error: 'Company settings not found' });
      return;
    }
    const settings = rows[0];
    if (typeof settings.terms_json === 'string') {
      try {
        settings.terms_json = JSON.parse(settings.terms_json);
      } catch (e) {
        settings.terms_json = [];
      }
    }
    res.json({ company: settings });
  } catch (error: any) {
    const errorMsg = error?.message || (typeof error === 'string' ? error : '') || getLastDbError() || 'Failed to fetch company settings';
    res.status(500).json({ error: errorMsg });
  }
});

// Update company profile (Admin only)
companyRouter.put('/', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const {
      company_name,
      tagline,
      logo_base64,
      address_line1,
      address_line2,
      phone,
      email,
      website,
      gstin,
      state,
      state_code,
      bank_name,
      account_name,
      account_number,
      ifsc_code,
      branch,
      account_type,
      upi_details,
      store_manager_title,
      store_manager_name,
      store_manager_phone,
      sales_associate_title,
      terms_json,
    } = req.body;

    const termsPayload = Array.isArray(terms_json) ? JSON.stringify(terms_json) : (terms_json || '[]');

    const rows = await query(
      `UPDATE company_settings
       SET company_name = COALESCE($1, company_name),
           tagline = COALESCE($2, tagline),
           logo_base64 = COALESCE($3, logo_base64),
           address_line1 = COALESCE($4, address_line1),
           address_line2 = COALESCE($5, address_line2),
           phone = COALESCE($6, phone),
           email = COALESCE($7, email),
           website = COALESCE($8, website),
           gstin = COALESCE($9, gstin),
           state = COALESCE($10, state),
           state_code = COALESCE($11, state_code),
           bank_name = COALESCE($12, bank_name),
           account_name = COALESCE($13, account_name),
           account_number = COALESCE($14, account_number),
           ifsc_code = COALESCE($15, ifsc_code),
           branch = COALESCE($16, branch),
           account_type = COALESCE($17, account_type),
           upi_details = COALESCE($18, upi_details),
           store_manager_title = COALESCE($19, store_manager_title),
           store_manager_name = COALESCE($20, store_manager_name),
           store_manager_phone = COALESCE($21, store_manager_phone),
           sales_associate_title = COALESCE($22, sales_associate_title),
           terms_json = $23,
           updated_at = NOW()
       WHERE id = 1
       RETURNING *`,
      [
        company_name,
        tagline,
        logo_base64,
        address_line1,
        address_line2,
        phone,
        email,
        website,
        gstin,
        state,
        state_code,
        bank_name,
        account_name,
        account_number,
        ifsc_code,
        branch,
        account_type,
        upi_details,
        store_manager_title,
        store_manager_name,
        store_manager_phone,
        sales_associate_title,
        termsPayload,
      ]
    );

    await recordAuditLog({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'COMPANY_SETTINGS_UPDATED',
      entityType: 'company_settings',
      entityId: 1,
      ipAddress: req.ip,
    });

    broadcast({ type: 'SETTINGS_UPDATED' });

    res.json({ company: rows[0] });
  } catch (error: any) {
    const errorMsg = error?.message || (typeof error === 'string' ? error : '') || getLastDbError() || 'Failed to fetch company settings';
    res.status(500).json({ error: errorMsg });
  }
});
