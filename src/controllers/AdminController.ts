
// ============================================================================
// FILE: src/controllers/AdminController.ts
// ============================================================================

import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError } from '../middleware/error.middleware';

export class AdminController {
  async getAllWallets(req: AuthRequest, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;
    
    const result = await query(
      `SELECT 
        w.id,
        w.user_id,
        u.email,
        w.created_at,
        COUNT(a.id) as address_count
       FROM wallets w
       JOIN users u ON w.user_id = u.id
       LEFT JOIN addresses a ON w.id = a.wallet_id
       GROUP BY w.id, u.email
       ORDER BY w.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    const countResult = await query('SELECT COUNT(*) FROM wallets');
    const total = parseInt(countResult.rows[0].count);
    
    logger.info('Admin viewed all wallets', {
      adminId: req.user?.id,
      page,
      limit
    });
    
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  }
  
  async getSuspiciousActivities(req: AuthRequest, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;
    
    const result = await query(
      `SELECT 
        sa.*,
        u.email
       FROM suspicious_activities sa
       JOIN users u ON sa.user_id = u.id
       ORDER BY sa.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    logger.info('Admin viewed suspicious activities', {
      adminId: req.user?.id,
      page,
      limit
    });
    
    res.json({
      success: true,
      data: result.rows
    });
  }
  
  async getPendingApprovals(req: AuthRequest, res: Response) {
    const result = await query(
      `SELECT 
        ta.*,
        u.email
       FROM transfer_approvals ta
       JOIN users u ON ta.requested_by = u.id
       WHERE ta.status = 'pending'
       ORDER BY ta.created_at ASC`
    );
    
    logger.info('Admin viewed pending approvals', {
      adminId: req.user?.id,
      count: result.rows.length
    });
    
    res.json({
      success: true,
      data: result.rows
    });
  }
  
  async approveTransfer(req: AuthRequest, res: Response) {
    const { id } = req.params;
    
    const result = await query(
      `UPDATE transfer_approvals
       SET status = 'approved', approved_by = $1, approved_at = NOW()
       WHERE id = $2 AND status = 'pending'
       RETURNING *`,
      [req.user?.id, id]
    );
    
    if (result.rows.length === 0) {
      throw new NotFoundError('Approval request not found or already processed');
    }
    
    logger.info('Transfer approved', {
      adminId: req.user?.id,
      approvalId: id,
      amount: result.rows[0].amount
    });
    
    res.json({
      success: true,
      message: 'Transfer approved',
      data: result.rows[0]
    });
  }
  
  async rejectTransfer(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { reason } = req.body;
    
    const result = await query(
      `UPDATE transfer_approvals
       SET status = 'rejected', 
           approved_by = $1, 
           approved_at = NOW(),
           rejection_reason = $3
       WHERE id = $2 AND status = 'pending'
       RETURNING *`,
      [req.user?.id, id, reason || null]
    );
    
    if (result.rows.length === 0) {
      throw new NotFoundError('Approval request not found or already processed');
    }
    
    logger.info('Transfer rejected', {
      adminId: req.user?.id,
      approvalId: id,
      reason
    });
    
    res.json({
      success: true,
      message: 'Transfer rejected',
      data: result.rows[0]
    });
  }
  
  async addHotWallet(req: AuthRequest, res: Response) {
    const { chain, address } = req.body;
    
    if (!chain || !address) {
      throw new ValidationError('chain and address are required');
    }
    
    const result = await query(
      `INSERT INTO hot_wallets (chain, address, added_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (chain, address) 
       DO UPDATE SET is_active = true
       RETURNING *`,
      [chain, address, req.user?.id]
    );
    
    logger.info('Hot wallet added', {
      adminId: req.user?.id,
      chain,
      address
    });
    
    res.status(201).json({
      success: true,
      message: 'Hot wallet added',
      data: result.rows[0]
    });
  }
  
  async getSystemStats(req: AuthRequest, res: Response) {
    const stats = await Promise.all([
      query('SELECT COUNT(*) as count FROM users'),
      query('SELECT COUNT(*) as count FROM wallets'),
      query('SELECT COUNT(*) as count FROM addresses'),
      query('SELECT COUNT(*) as count FROM transactions'),
      query('SELECT COUNT(*) as count FROM transactions WHERE status = \'pending\''),
      query('SELECT COUNT(*) as count FROM transfer_approvals WHERE status = \'pending\''),
      query('SELECT SUM(amount) as total FROM transactions WHERE status = \'confirmed\' AND created_at >= CURRENT_DATE'),
      query('SELECT COUNT(DISTINCT user_id) as count FROM login_attempts WHERE created_at >= NOW() - INTERVAL \'24 hours\' AND success = true')
    ]);
    
    logger.info('Admin viewed system stats', {
      adminId: req.user?.id
    });
    
    res.json({
      success: true,
      data: {
        totalUsers: parseInt(stats[0].rows[0].count),
        totalWallets: parseInt(stats[1].rows[0].count),
        totalAddresses: parseInt(stats[2].rows[0].count),
        totalTransactions: parseInt(stats[3].rows[0].count),
        pendingTransactions: parseInt(stats[4].rows[0].count),
        pendingApprovals: parseInt(stats[5].rows[0].count),
        todayVolume: parseFloat(stats[6].rows[0].total || 0),
        activeUsersToday: parseInt(stats[7].rows[0].count)
      }
    });
  }
  
  async getAuditLogs(req: AuthRequest, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = (page - 1) * limit;
    
    // This would read from log files or a dedicated audit log table
    // For now, return transaction and login history
    const result = await query(
      `SELECT 
        'transaction' as type,
        t.id,
        t.from_address,
        t.to_address,
        t.amount,
        t.status,
        t.created_at
       FROM transactions t
       UNION ALL
       SELECT 
        'login' as type,
        la.id::text,
        u.email as from_address,
        la.ip_address as to_address,
        NULL as amount,
        CASE WHEN la.success THEN 'success' ELSE 'failed' END as status,
        la.created_at
       FROM login_attempts la
       JOIN users u ON la.user_id = u.id
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    logger.info('Admin viewed audit logs', {
      adminId: req.user?.id,
      page,
      limit
    });
    
    res.json({
      success: true,
      data: result.rows
    });
  }
}