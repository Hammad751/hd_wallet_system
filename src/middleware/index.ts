export * from './auth.middleware';
export * from './validation.middleware';
export * from './rateLimit.middleware';
export * from './security.middleware';
export * from './error.middleware';
export * from './transaction.middleware';
export * from './logging.middleware';

// Large transfer approval requirement
const APPROVAL_THRESHOLD = 100; // Transfers over 100 units require approval

export const checkApprovalRequired = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { amount } = req.body;
    const transferAmount = parseFloat(amount);
    
    if (transferAmount > APPROVAL_THRESHOLD) {
      // Check if approval exists
      const approvalResult = await query(
        `SELECT * FROM transfer_approvals
         WHERE from_address = $1 
         AND to_address = $2
         AND amount = $3
         AND status = 'approved'
         AND created_at >= NOW() - INTERVAL '1 hour'`,
        [req.body.fromAddress, req.body.toAddress, amount]
      );
      
      if (approvalResult.rows.length === 0 && req.user?.role !== 'admin') {
        logger.info('Large transfer requires approval', {
          userId: req.user?.id,
          amount: transferAmount,
          threshold: APPROVAL_THRESHOLD
        });
        
        // Create approval request
        await query(
          `INSERT INTO transfer_approvals 
           (from_address, to_address, amount, chain, token, requested_by, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
          [
            req.body.fromAddress,
            req.body.toAddress,
            amount,
            req.body.chain,
            req.body.token || null,
            req.user?.id
          ]
        );
        
        return res.status(202).json({
          error: 'Approval required',
          message: `Transfers over ${APPROVAL_THRESHOLD} units require admin approval`,
          status: 'pending_approval',
          threshold: APPROVAL_THRESHOLD,
          amount: transferAmount
        });
      }
    }
    
    next();
  } catch (error: any) {
    logger.error('Error checking approval requirement', error);
    next(error);
  }
};

// Suspicious activity detection
export const detectSuspiciousActivity = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next();
    }
    
    const { fromAddress, toAddress, amount } = req.body;
    const transferAmount = parseFloat(amount);
    
    // Check for rapid successive transfers
    const recentTransfers = await query(
      `SELECT COUNT(*) as count
       FROM transactions
       WHERE from_address = $1
       AND created_at >= NOW() - INTERVAL '5 minutes'`,
      [fromAddress]
    );
    
    const recentCount = parseInt(recentTransfers.rows[0].count);
    
    if (recentCount >= 5) {
      logger.warn('Suspicious activity: Rapid transfers detected', {
        userId: req.user.id,
        fromAddress,
        count: recentCount
      });
      
      // Don't block, but flag for review
      (req as any).suspicious = true;
    }
    
    // Check for unusual transfer patterns
    const avgTransfer = await query(
      `SELECT AVG(amount) as avg_amount
       FROM transactions
       WHERE from_address = $1
       AND created_at >= NOW() - INTERVAL '30 days'`,
      [fromAddress]
    );
    
    const avgAmount = parseFloat(avgTransfer.rows[0].avg_amount || '0');
    
    if (avgAmount > 0 && transferAmount > avgAmount * 10) {
      logger.warn('Suspicious activity: Unusually large transfer', {
        userId: req.user.id,
        fromAddress,
        amount: transferAmount,
        avgAmount
      });
      
      (req as any).suspicious = true;
    }
    
    // Log suspicious activity
    if ((req as any).suspicious) {
      await query(
        `INSERT INTO suspicious_activities 
         (user_id, activity_type, details, ip_address)
         VALUES ($1, $2, $3, $4)`,
        [
          req.user.id,
          'suspicious_transfer',
          JSON.stringify({ fromAddress, toAddress, amount }),
          req.ip
        ]
      );
    }
    
    next();
  } catch (error: any) {
    logger.error('Error detecting suspicious activity', error);
    next(error);
  }
};