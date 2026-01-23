import { Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AuthRequest } from './auth.middleware';

export const requestLogger = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();
  
  // Log request
  logger.info('Incoming request', {
    requestId: (req as any).requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.id
  });
  
  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    const logData = {
      requestId: (req as any).requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userId: req.user?.id,
      suspicious: (req as any).suspicious || false
    };
    
    if (res.statusCode >= 500) {
      logger.error('Request failed', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request error', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });
  
  return next();
};

export const sensitiveDataLogger = (
  req: AuthRequest,
  next: NextFunction
) => {
  // Log sensitive operations
  const sensitivePaths = ['/wallet', '/transfer', '/flush'];
  const isSensitive = sensitivePaths.some(path => req.path.includes(path));
  
  if (isSensitive && req.method !== 'GET') {
    logger.warn('Sensitive operation', {
      requestId: (req as any).requestId,
      userId: req.user?.id,
      operation: `${req.method} ${req.path}`,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
  }
  
  return next();
};
