import { Response } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { 
  ValidationError, 
  NotFoundError, 
  ConflictError,
  AuthorizationError 
} from '../middleware/error.middleware';

export class UserController {
  /**
   * Get current user profile
   * GET /api/v1/users/me
   */
  async getProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        throw new ValidationError('User not authenticated');
      }

      const result = await query(
        `SELECT 
          u.id,
          u.email,
          u.name,
          u.role,
          u.is_active,
          u.created_at,
          u.last_login,
          COUNT(DISTINCT w.id) as wallet_count,
          COUNT(DISTINCT a.id) as address_count
         FROM users u
         LEFT JOIN wallets w ON u.id = w.user_id
         LEFT JOIN addresses a ON w.id = a.wallet_id
         WHERE u.id = $1
         GROUP BY u.id`,
        [req.user.id]
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('User not found');
      }

      logger.info('User profile retrieved', {
        userId: req.user.id
      });

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error: any) {
      logger.error('Error getting profile', {
        error: error.message,
        userId: req.user?.id
      });
      throw error;
    }
  }

  /**
   * Update user profile
   * PUT /api/v1/users/me
   */
  async updateProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        throw new ValidationError('User not authenticated');
      }

      const { name, email } = req.body;
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(name);
      }

      if (email !== undefined) {
        // Check if email is already taken by another user
        const emailCheck = await query(
          'SELECT id FROM users WHERE email = $1 AND id != $2',
          [email, req.user.id]
        );

        if (emailCheck.rows.length > 0) {
          throw new ConflictError('Email already in use');
        }

        updates.push(`email = $${paramCount++}`);
        values.push(email);
      }

      if (updates.length === 0) {
        throw new ValidationError('No fields to update');
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(req.user.id);

      const result = await query(
        `UPDATE users 
         SET ${updates.join(', ')}
         WHERE id = $${paramCount}
         RETURNING id, email, name, role, updated_at`,
        values
      );

      logger.info('User profile updated', {
        userId: req.user.id,
        updates: Object.keys(req.body)
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: result.rows[0]
      });
    } catch (error: any) {
      logger.error('Error updating profile', {
        error: error.message,
        userId: req.user?.id
      });
      throw error;
    }
  }

  /**
   * Change password
   * PUT /api/v1/users/me/password
   */
  async changePassword(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        throw new ValidationError('User not authenticated');
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        throw new ValidationError('Current and new password are required');
      }

      // Get current password hash
      const userResult = await query(
        'SELECT password FROM users WHERE id = $1',
        [req.user.id]
      );

      if (userResult.rows.length === 0) {
        throw new NotFoundError('User not found');
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(
        currentPassword,
        userResult.rows[0].password
      );

      if (!isValidPassword) {
        logger.warn('Invalid current password attempt', {
          userId: req.user.id,
          ip: req.ip
        });
        throw new ValidationError('Current password is incorrect');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update password
      await query(
        `UPDATE users 
         SET password = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [hashedPassword, req.user.id]
      );

      logger.info('Password changed', {
        userId: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error: any) {
      logger.error('Error changing password', {
        error: error.message,
        userId: req.user?.id
      });
      throw error;
    }
  }

  /**
   * Get user by ID (admin or self only)
   * GET /api/v1/users/:userId
   */
  async getUserById(req: AuthRequest, res: Response) {
    try {
      const { userId } = req.params;

      // Check authorization
      if (req.user?.id !== userId && req.user?.role !== 'admin') {
        throw new AuthorizationError('You can only view your own profile');
      }

      const result = await query(
        `SELECT 
          u.id,
          u.email,
          u.name,
          u.role,
          u.is_active,
          u.created_at,
          u.last_login,
          COUNT(DISTINCT w.id) as wallet_count,
          COUNT(DISTINCT a.id) as address_count,
          COUNT(DISTINCT t.id) as transaction_count,
          COALESCE(SUM(CASE WHEN t.status = 'confirmed' THEN t.amount ELSE 0 END), 0) as total_volume
         FROM users u
         LEFT JOIN wallets w ON u.id = w.user_id
         LEFT JOIN addresses a ON w.id = a.wallet_id
         LEFT JOIN transactions t ON a.address = t.from_address
         WHERE u.id = $1
         GROUP BY u.id`,
        [userId]
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('User not found');
      }

      logger.info('User retrieved', {
        requestedBy: req.user?.id,
        targetUser: userId
      });

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error: any) {
      logger.error('Error getting user', {
        error: error.message,
        userId: req.params.userId
      });
      throw error;
    }
  }

  /**
   * Get all users (admin only)
   * GET /api/v1/users
   */
  async getAllUsers(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = (page - 1) * limit;
      const search = req.query.search as string;
      const role = req.query.role as string;
      const status = req.query.status as string;

      let whereClause = 'WHERE 1=1';
      const values: any[] = [];
      let paramCount = 1;

      if (search) {
        whereClause += ` AND (u.email ILIKE $${paramCount} OR u.name ILIKE $${paramCount})`;
        values.push(`%${search}%`);
        paramCount++;
      }

      if (role) {
        whereClause += ` AND u.role = $${paramCount}`;
        values.push(role);
        paramCount++;
      }

      if (status === 'active') {
        whereClause += ` AND u.is_active = true`;
      } else if (status === 'inactive') {
        whereClause += ` AND u.is_active = false`;
      }

      const result = await query(
        `SELECT 
          u.id,
          u.email,
          u.name,
          u.role,
          u.is_active,
          u.created_at,
          u.last_login,
          COUNT(DISTINCT w.id) as wallet_count,
          COUNT(DISTINCT a.id) as address_count
         FROM users u
         LEFT JOIN wallets w ON u.id = w.user_id
         LEFT JOIN addresses a ON w.id = a.wallet_id
         ${whereClause}
         GROUP BY u.id
         ORDER BY u.created_at DESC
         LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
        [...values, limit, offset]
      );

      const countResult = await query(
        `SELECT COUNT(*) FROM users u ${whereClause}`,
        values
      );

      const total = parseInt(countResult.rows[0].count);

      logger.info('Users listed', {
        adminId: req.user?.id,
        page,
        limit,
        total
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
    } catch (error: any) {
      logger.error('Error listing users', {
        error: error.message,
        adminId: req.user?.id
      });
      throw error;
    }
  }

  /**
   * Deactivate user account
   * DELETE /api/v1/users/me
   */
  async deactivateAccount(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        throw new ValidationError('User not authenticated');
      }

      const { password } = req.body;

      if (!password) {
        throw new ValidationError('Password confirmation required');
      }

      // Verify password
      const userResult = await query(
        'SELECT password FROM users WHERE id = $1',
        [req.user.id]
      );

      const isValidPassword = await bcrypt.compare(
        password,
        userResult.rows[0].password
      );

      if (!isValidPassword) {
        throw new ValidationError('Invalid password');
      }

      // Deactivate account
      await query(
        'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [req.user.id]
      );

      logger.warn('User account deactivated', {
        userId: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Account deactivated successfully'
      });
    } catch (error: any) {
      logger.error('Error deactivating account', {
        error: error.message,
        userId: req.user?.id
      });
      throw error;
    }
  }

  /**
   * Activate/Deactivate user (admin only)
   * PATCH /api/v1/users/:userId/status
   */
  async updateUserStatus(req: AuthRequest, res: Response) {
    try {
      const { userId } = req.params;
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        throw new ValidationError('isActive must be a boolean');
      }

      // Prevent deactivating self
      if (userId === req.user?.id) {
        throw new ValidationError('Cannot change your own status');
      }

      const result = await query(
        `UPDATE users 
         SET is_active = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, email, is_active`,
        [isActive, userId]
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('User not found');
      }

      logger.warn('User status changed by admin', {
        adminId: req.user?.id,
        targetUserId: userId,
        newStatus: isActive
      });

      res.json({
        success: true,
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
        data: result.rows[0]
      });
    } catch (error: any) {
      logger.error('Error updating user status', {
        error: error.message,
        adminId: req.user?.id,
        targetUserId: req.params.userId
      });
      throw error;
    }
  }

  /**
   * Update user role (admin only)
   * PATCH /api/v1/users/:userId/role
   */
  async updateUserRole(req: AuthRequest, res: Response) {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      if (!['user', 'admin'].includes(role)) {
        throw new ValidationError('Invalid role. Must be "user" or "admin"');
      }

      // Prevent changing own role
      if (userId === req.user?.id) {
        throw new ValidationError('Cannot change your own role');
      }

      const result = await query(
        `UPDATE users 
         SET role = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, email, role`,
        [role, userId]
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('User not found');
      }

      logger.warn('User role changed by admin', {
        adminId: req.user?.id,
        targetUserId: userId,
        newRole: role
      });

      res.json({
        success: true,
        message: 'User role updated successfully',
        data: result.rows[0]
      });
    } catch (error: any) {
      logger.error('Error updating user role', {
        error: error.message,
        adminId: req.user?.id,
        targetUserId: req.params.userId
      });
      throw error;
    }
  }

  /**
   * Get user activity history
   * GET /api/v1/users/:userId/activity
   */
  async getUserActivity(req: AuthRequest, res: Response) {
    try {
      const { userId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = (page - 1) * limit;

      // Check authorization
      if (req.user?.id !== userId && req.user?.role !== 'admin') {
        throw new AuthorizationError('You can only view your own activity');
      }

      // Get login history
      const loginHistory = await query(
        `SELECT 
          id,
          success,
          ip_address,
          user_agent,
          created_at
         FROM login_attempts
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [userId]
      );

      // Get transaction history
      const transactions = await query(
        `SELECT 
          t.id,
          t.from_address,
          t.to_address,
          t.amount,
          t.chain,
          t.status,
          t.tx_hash,
          t.created_at
         FROM transactions t
         JOIN addresses a ON t.from_address = a.address
         JOIN wallets w ON a.wallet_id = w.id
         WHERE w.user_id = $1
         ORDER BY t.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      // Get suspicious activities
      const suspiciousActivities = await query(
        `SELECT 
          id,
          activity_type,
          details,
          severity,
          reviewed,
          created_at
         FROM suspicious_activities
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [userId]
      );

      logger.info('User activity retrieved', {
        requestedBy: req.user?.id,
        targetUser: userId
      });

      res.json({
        success: true,
        data: {
          loginHistory: loginHistory.rows,
          transactions: transactions.rows,
          suspiciousActivities: suspiciousActivities.rows
        }
      });
    } catch (error: any) {
      logger.error('Error getting user activity', {
        error: error.message,
        userId: req.params.userId
      });
      throw error;
    }
  }

  /**
   * Get user statistics
   * GET /api/v1/users/:userId/stats
   */
  async getUserStats(req: AuthRequest, res: Response) {
    try {
      const { userId } = req.params;

      // Check authorization
      if (req.user?.id !== userId && req.user?.role !== 'admin') {
        throw new AuthorizationError('You can only view your own statistics');
      }

      // Get comprehensive statistics
      const stats = await Promise.all([
        // Total wallets
        query(
          'SELECT COUNT(*) as count FROM wallets WHERE user_id = $1',
          [userId]
        ),
        
        // Total addresses
        query(
          `SELECT COUNT(*) as count 
           FROM addresses a
           JOIN wallets w ON a.wallet_id = w.id
           WHERE w.user_id = $1`,
          [userId]
        ),
        
        // Total transactions
        query(
          `SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
            COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
           FROM transactions t
           JOIN addresses a ON t.from_address = a.address
           JOIN wallets w ON a.wallet_id = w.id
           WHERE w.user_id = $1`,
          [userId]
        ),
        
        // Total volume by chain
        query(
          `SELECT 
            t.chain,
            COUNT(*) as transaction_count,
            COALESCE(SUM(CASE WHEN t.status = 'confirmed' THEN t.amount ELSE 0 END), 0) as volume
           FROM transactions t
           JOIN addresses a ON t.from_address = a.address
           JOIN wallets w ON a.wallet_id = w.id
           WHERE w.user_id = $1
           GROUP BY t.chain`,
          [userId]
        ),
        
        // Recent activity (last 30 days)
        query(
          `SELECT 
            DATE(t.created_at) as date,
            COUNT(*) as count
           FROM transactions t
           JOIN addresses a ON t.from_address = a.address
           JOIN wallets w ON a.wallet_id = w.id
           WHERE w.user_id = $1 
           AND t.created_at >= NOW() - INTERVAL '30 days'
           GROUP BY DATE(t.created_at)
           ORDER BY date DESC`,
          [userId]
        ),
        
        // Login statistics
        query(
          `SELECT 
            COUNT(*) as total_logins,
            COUNT(CASE WHEN success = true THEN 1 END) as successful_logins,
            COUNT(CASE WHEN success = false THEN 1 END) as failed_logins,
            MAX(created_at) as last_login
           FROM login_attempts
           WHERE user_id = $1`,
          [userId]
        )
      ]);

      logger.info('User statistics retrieved', {
        requestedBy: req.user?.id,
        targetUser: userId
      });

      res.json({
        success: true,
        data: {
          wallets: {
            total: parseInt(stats[0].rows[0].count)
          },
          addresses: {
            total: parseInt(stats[1].rows[0].count)
          },
          transactions: {
            total: parseInt(stats[2].rows[0].total),
            confirmed: parseInt(stats[2].rows[0].confirmed),
            pending: parseInt(stats[2].rows[0].pending),
            failed: parseInt(stats[2].rows[0].failed)
          },
          volumeByChain: stats[3].rows,
          recentActivity: stats[4].rows,
          loginStats: stats[5].rows[0]
        }
      });
    } catch (error: any) {
      logger.error('Error getting user statistics', {
        error: error.message,
        userId: req.params.userId
      });
      throw error;
    }
  }

  /**
   * Delete user permanently (admin only)
   * DELETE /api/v1/users/:userId
   */
  async deleteUser(req: AuthRequest, res: Response) {
    try {
      const { userId } = req.params;

      // Prevent deleting self
      if (userId === req.user?.id) {
        throw new ValidationError('Cannot delete your own account');
      }

      // Check if user exists
      const userCheck = await query(
        'SELECT email FROM users WHERE id = $1',
        [userId]
      );

      if (userCheck.rows.length === 0) {
        throw new NotFoundError('User not found');
      }

      // Delete user (cascade will delete related records)
      await query('DELETE FROM users WHERE id = $1', [userId]);

      logger.warn('User permanently deleted', {
        adminId: req.user?.id,
        deletedUserId: userId,
        deletedEmail: userCheck.rows[0].email
      });

      res.json({
        success: true,
        message: 'User deleted permanently'
      });
    } catch (error: any) {
      logger.error('Error deleting user', {
        error: error.message,
        adminId: req.user?.id,
        targetUserId: req.params.userId
      });
      throw error;
    }
  }
}