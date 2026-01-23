// ============================================================================
// FILE: src/middleware/auth.middleware.ts
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'user' | 'admin';
    iat?: number;
    exp?: number;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Authentication failed: No token provided', {
        ip: req.ip,
        path: req.path
      });
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No token provided' 
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Invalid token format' 
      });
    }
    
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as AuthRequest['user'];
      req.user = decoded;
      
      logger.info('User authenticated', {
        userId: decoded.id,
        role: decoded.role,
        ip: req.ip
      });
      
      next();
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        logger.warn('Authentication failed: Token expired', {
          ip: req.ip,
          expiredAt: err.expiredAt
        });
        return res.status(401).json({ 
          error: 'Authentication required',
          message: 'Token expired' 
        });
      }
      
      if (err.name === 'JsonWebTokenError') {
        logger.warn('Authentication failed: Invalid token', {
          ip: req.ip,
          error: err.message
        });
        return res.status(401).json({ 
          error: 'Authentication required',
          message: 'Invalid token' 
        });
      }
      
      throw err;
    }
  } catch (error: any) {
    logger.error('Authentication error', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });
    return res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
};

export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required' 
    });
  }
  
  if (req.user.role !== 'admin') {
    logger.warn('Authorization failed: Admin required', {
      userId: req.user.id,
      role: req.user.role,
      ip: req.ip,
      path: req.path
    });
    return res.status(403).json({ 
      error: 'Forbidden',
      message: 'Admin privileges required' 
    });
  }
  
  next();
};

export const authorizeUser = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required' 
    });
  }
  
  const { userId } = req.params;
  
  // Allow if user is accessing their own resource or is admin
  if (req.user.id !== userId && req.user.role !== 'admin') {
    logger.warn('Authorization failed: User accessing unauthorized resource', {
      userId: req.user.id,
      attemptedUserId: userId,
      ip: req.ip,
      path: req.path
    });
    return res.status(403).json({ 
      error: 'Forbidden',
      message: 'You can only access your own resources' 
    });
  }
  
  next();
};

export const generateToken = (user: {
  id: string;
  email: string;
  role: 'user' | 'admin';
}): string => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    config.jwt.secret,
    { 
      expiresIn: config.jwt.expiresIn,
      issuer: 'hd-wallet-api',
      audience: 'hd-wallet-client'
    }
  );
};

export const refreshToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required' 
    });
  }
  
  const newToken = generateToken({
    id: req.user.id,
    email: req.user.email,
    role: req.user.role
  });
  
  res.setHeader('X-New-Token', newToken);
  next();
};


