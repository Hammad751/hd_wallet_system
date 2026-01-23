
import { Response, NextFunction } from 'express';
import { query } from '../config/database';
import { logger } from '../utils/logger';
import { AuthRequest } from './auth.middleware';

// Daily transfer limit tracker
const DAILY_LIMITS: { [key: string]: number } = {
  user: 10, // 10 units per day for regular users
  admin: 1000 // 1000 units per day for admins
};

export const checkDailyLimit = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { fromAddress, amount } = req.body;
    const limit = DAILY_LIMITS[req.user.role] || DAILY_LIMITS.user;
    
    // Get today's transfers
    const result = await query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE from_address = $1 
       AND created_at >= CURRENT_DATE
       AND status != 'failed'`,
      [fromAddress]
    );
    
    const dailyTotal = parseFloat(result.rows[0].total);
    const requestAmount = parseFloat(amount);
    
    if (dailyTotal + requestAmount > limit) {
      logger.warn('Daily transfer limit exceeded', {
        userId: req.user.id,
        fromAddress,
        dailyTotal,
        requestAmount,
        limit
      });
      
      return res.status(429).json({
        error: 'Daily limit exceeded',
        message: `Daily transfer limit is ${limit} units. Current: ${dailyTotal}`,
        details: {
          limit,
          used: dailyTotal,
          requested: requestAmount,
          remaining: Math.max(0, limit - dailyTotal)
        }
      });
    }
    
    return next();
  } catch (error: any) {
    logger.error('Error checking daily limit', error);
    return next(error);
  }
};
