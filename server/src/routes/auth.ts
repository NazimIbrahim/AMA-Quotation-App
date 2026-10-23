import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/connection';
import { config } from '../config';
import { authenticateToken, AuthUser } from '../middleware/auth';
import { recordAuditLog } from '../utils/audit';

export const authRouter = Router();

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const rows = await query(
      `SELECT id, username, password_hash, full_name, role, email, phone, is_active
       FROM users WHERE LOWER(username) = LOWER($1)`,
      [username.trim()]
    );

    if (rows.length === 0) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const user = rows[0];
    if (!user.is_active) {
      res.status(403).json({ error: 'Account is deactivated. Contact Administrator.' });
      return;
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const payload: AuthUser = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      email: user.email,
      phone: user.phone,
    };

    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });

    await recordAuditLog({
      userId: user.id,
      username: user.username,
      action: 'USER_LOGIN',
      entityType: 'user',
      entityId: user.id,
      ipAddress: req.ip,
    });

    res.json({
      token,
      user: payload,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error during login' });
  }
});

authRouter.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const rows = await query(
      `SELECT id, username, full_name, role, email, phone, monthly_target, is_active
       FROM users WHERE id = $1`,
      [req.user!.id]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user: rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

authRouter.put('/profile', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { full_name, email, phone, current_password, new_password } = req.body;

    if (new_password) {
      if (!current_password) {
        res.status(400).json({ error: 'Current password required to set new password' });
        return;
      }
      const userRows = await query('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
      const valid = await bcrypt.compare(current_password, userRows[0].password_hash);
      if (!valid) {
        res.status(400).json({ error: 'Incorrect current password' });
        return;
      }
      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(new_password, salt);
      await query(
        `UPDATE users SET password_hash = $1, full_name = COALESCE($2, full_name),
         email = COALESCE($3, email), phone = COALESCE($4, phone), updated_at = NOW()
         WHERE id = $5`,
        [newHash, full_name, email, phone, req.user!.id]
      );
    } else {
      await query(
        `UPDATE users SET full_name = COALESCE($1, full_name),
         email = COALESCE($2, email), phone = COALESCE($3, phone), updated_at = NOW()
         WHERE id = $4`,
        [full_name, email, phone, req.user!.id]
      );
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
