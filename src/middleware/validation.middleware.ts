import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { ChainType } from '../types';
import { logger } from '../utils/logger';

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    logger.warn('Validation failed', {
      errors: errors.array(),
      path: req.path,
      ip: req.ip
    });
    
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.type === 'field' ? err.path : undefined,
        message: err.msg,
        value: err.type === 'field' ? err.value : undefined
      }))
    });
  }
  
  return next();
};

// Wallet validation
export const validateWalletCreation = [
  body('userId')
    .isUUID()
    .withMessage('userId must be a valid UUID'),
  
  body('chains')
    .isArray({ min: 1, max: 10 })
    .withMessage('chains must be an array with 1-10 items'),
  
  body('chains.*')
    .isIn(Object.values(ChainType))
    .withMessage('Invalid chain type'),
  
  handleValidationErrors
];

export const validateAddressGeneration = [
  param('userId')
    .isUUID()
    .withMessage('userId must be a valid UUID'),
  
  body('chain')
    .isIn(Object.values(ChainType))
    .withMessage('Invalid chain type'),
  
  body('network')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('network must be 1-50 characters'),
  
  handleValidationErrors
];

// Transfer validation
export const validateTransfer = [
  body('fromAddress')
    .isString()
    .trim()
    .notEmpty()
    .isLength({ min: 20, max: 100 })
    .withMessage('fromAddress must be 20-100 characters'),
  
  body('toAddress')
    .isString()
    .trim()
    .notEmpty()
    .isLength({ min: 20, max: 100 })
    .withMessage('toAddress must be 20-100 characters'),
  
  body('amount')
    .isString()
    .trim()
    .notEmpty()
    .matches(/^\d+(\.\d+)?$/)
    .withMessage('amount must be a valid number')
    .custom((value) => {
      const num = parseFloat(value);
      if (num <= 0) {
        throw new Error('amount must be greater than 0');
      }
      if (num > 1000000) {
        throw new Error('amount exceeds maximum allowed (1,000,000)');
      }
      return true;
    }),
  
  body('chain')
    .isIn(Object.values(ChainType))
    .withMessage('Invalid chain type'),
  
  body('token')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 20, max: 100 })
    .withMessage('token must be 20-100 characters'),
  
  handleValidationErrors
];

// Flush validation
export const validateFlush = [
  body('userAddresses')
    .isArray({ min: 1, max: 1000 })
    .withMessage('userAddresses must be an array with 1-1000 items'),
  
  body('userAddresses.*')
    .isString()
    .trim()
    .notEmpty()
    .isLength({ min: 20, max: 100 })
    .withMessage('Each address must be 20-100 characters'),
  
  body('hotWalletAddress')
    .isString()
    .trim()
    .notEmpty()
    .isLength({ min: 20, max: 100 })
    .withMessage('hotWalletAddress must be 20-100 characters'),
  
  body('chain')
    .isIn(Object.values(ChainType))
    .withMessage('Invalid chain type'),
  
  body('token')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 20, max: 100 })
    .withMessage('token must be 20-100 characters'),
  
  handleValidationErrors
];

// Transaction status validation
export const validateTransactionStatus = [
  param('txHash')
    .isString()
    .trim()
    .notEmpty()
    .isLength({ min: 20, max: 100 })
    .withMessage('txHash must be 20-100 characters'),
  
  query('chain')
    .isString()
    .trim()
    .notEmpty()
    .isIn(Object.values(ChainType))
    .withMessage('Invalid chain type'),
  
  handleValidationErrors
];

// User ID validation
export const validateUserId = [
  param('userId')
    .isUUID()
    .withMessage('userId must be a valid UUID'),
  
  handleValidationErrors
];

// Sanitize input to prevent XSS
export const sanitizeInput = (
  req: Request,
  // res: Response,
  next: NextFunction
) => {
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj.replace(/[<>]/g, '');
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        sanitized[key] = sanitize(obj[key]);
      }
      return sanitized;
    }
    return obj;
  };
  
  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);
  
  return next();
};