import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import crypto from 'crypto';
import { logger } from '../utils/logger';

// Apply security headers
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
  hidePoweredBy: true
});

// HTTPS redirect
export const httpsRedirect = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (process.env.NODE_ENV === 'production') {
    if (!req.secure && req.get('x-forwarded-proto') !== 'https') {
      logger.warn('HTTP request redirected to HTTPS', {
        ip: req.ip,
        path: req.path
      });
      return res.redirect(301, `https://${req.get('host')}${req.url}`);
    }
  }
  return next();
};

// IP Whitelist for admin endpoints
const ADMIN_IP_WHITELIST = (process.env.ADMIN_IP_WHITELIST || '').split(',').filter(Boolean);

export const ipWhitelist = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (ADMIN_IP_WHITELIST.length === 0) {
    // If no whitelist configured, allow (development mode)
    return next();
  }
  
  const clientIp = req.ip || req.socket.remoteAddress || '';
  
  if (!ADMIN_IP_WHITELIST.includes(clientIp)) {
    logger.warn('IP not whitelisted for admin access', {
      ip: clientIp,
      path: req.path
    });
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied from this IP address'
    });
  }
  
  return next();
};

// Request ID for tracing
export const requestId = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const id = crypto.randomBytes(16).toString('hex');
  (req as any).requestId = id;
  res.setHeader('X-Request-ID', id);
  return next();
};

// CORS configuration
export const corsOptions = {
  origin: (origin: string | undefined, callback: Function) => {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // In development, allow all origins
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // In production, check whitelist
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS origin not allowed', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID', 'X-New-Token'],
  maxAge: 86400 // 24 hours
};

// Prevent parameter pollution
export const preventParameterPollution = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Check for duplicate query parameters
  const queryKeys = Object.keys(req.query);
  const uniqueKeys = new Set(queryKeys);
  
  if (queryKeys.length !== uniqueKeys.size) {
    logger.warn('Parameter pollution detected', {
      ip: req.ip,
      query: req.query
    });
    return res.status(400).json({
      error: 'Invalid request',
      message: 'Duplicate parameters not allowed'
    });
  }
  
  return next();
};

// Content type validation
export const validateContentType = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type');
    
    if (!contentType || !contentType.includes('application/json')) {
      logger.warn('Invalid content type', {
        ip: req.ip,
        contentType,
        method: req.method
      });
      return res.status(415).json({
        error: 'Unsupported Media Type',
        message: 'Content-Type must be application/json'
      });
    }
  }
  
  return next();
};

// Request size limiter
export const requestSizeLimiter = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const contentLength = parseInt(req.get('content-length') || '0', 10);
  const MAX_SIZE = 1024 * 1024; // 1MB
  
  if (contentLength > MAX_SIZE) {
    logger.warn('Request size exceeded', {
      ip: req.ip,
      size: contentLength,
      maxSize: MAX_SIZE
    });
    return res.status(413).json({
      error: 'Payload Too Large',
      message: 'Request size exceeds maximum allowed (1MB)'
    });
  }
  
  return next();
};
