import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import { logger } from '../utils/logger';

// Create Redis client (optional, falls back to memory store)
let redisClient: ReturnType<typeof createClient> | null = null;

if (process.env.REDIS_URL) {
  redisClient = createClient({
    url: process.env.REDIS_URL
  });
  
  redisClient.connect().catch((err) => {
    logger.error('Redis connection failed, using memory store', err);
    redisClient = null;
  });
}

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: {
    error: 'Too many requests',
    message: 'Please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: redisClient ? new RedisStore({
    sendCommand: (...args: string[]) => redisClient!.sendCommand(args),
    prefix: 'rl:api:'
  }) : undefined,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      limit: 'api'
    });
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please try again later'
    });
  }
});

// Strict limiter for wallet creation
export const walletCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 wallet creations per hour
  message: {
    error: 'Too many wallet creation attempts',
    message: 'Please try again later'
  },
  skipSuccessfulRequests: false,
  store: redisClient ? new RedisStore({
    sendCommand: (...args: string[]) => redisClient!.sendCommand(args),
    prefix: 'rl:wallet:'
  }) : undefined,
  handler: (req, res) => {
    logger.warn('Wallet creation rate limit exceeded', {
      ip: req.ip,
      userId: (req as any).user?.id
    });
    res.status(429).json({
      error: 'Too many wallet creation attempts',
      message: 'Maximum 5 wallets per hour. Please try again later.'
    });
  }
});

// Transfer rate limiter
export const transferLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 transfers per 5 minutes
  message: {
    error: 'Too many transfer attempts',
    message: 'Please try again later'
  },
  store: redisClient ? new RedisStore({
    sendCommand: (...args: string[]) => redisClient!.sendCommand(args),
    prefix: 'rl:transfer:'
  }) : undefined,
  handler: (req, res) => {
    logger.warn('Transfer rate limit exceeded', {
      ip: req.ip,
      userId: (req as any).user?.id
    });
    res.status(429).json({
      error: 'Too many transfer attempts',
      message: 'Maximum 10 transfers per 5 minutes. Please try again later.'
    });
  }
});

// Address generation limiter
export const addressLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 addresses per hour
  message: {
    error: 'Too many address generation attempts',
    message: 'Please try again later'
  },
  store: redisClient ? new RedisStore({
    sendCommand: (...args: string[]) => redisClient!.sendCommand(args),
    prefix: 'rl:address:'
  }) : undefined,
  handler: (req, res) => {
    logger.warn('Address generation rate limit exceeded', {
      ip: req.ip,
      userId: (req as any).user?.id
    });
    res.status(429).json({
      error: 'Too many address generation attempts',
      message: 'Maximum 50 addresses per hour. Please try again later.'
    });
  }
});

// Flush operation limiter (admin only, very strict)
export const flushLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 flush operations per hour
  message: {
    error: 'Too many flush attempts',
    message: 'Please try again later'
  },
  store: redisClient ? new RedisStore({
    sendCommand: (...args: string[]) => redisClient!.sendCommand(args),
    prefix: 'rl:flush:'
  }) : undefined,
  handler: (req, res) => {
    logger.warn('Flush rate limit exceeded', {
      ip: req.ip,
      userId: (req as any).user?.id
    });
    res.status(429).json({
      error: 'Too many flush attempts',
      message: 'Maximum 10 flush operations per hour. Please try again later.'
    });
  }
});

// Login attempt limiter
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 failed login attempts
  skipSuccessfulRequests: true,
  message: {
    error: 'Too many login attempts',
    message: 'Please try again after 15 minutes'
  },
  store: redisClient ? new RedisStore({
    sendCommand: (...args: string[]) => redisClient!.sendCommand(args),
    prefix: 'rl:login:'
  }) : undefined,
  handler: (req, res) => {
    logger.warn('Login rate limit exceeded', {
      ip: req.ip,
      email: req.body.email
    });
    res.status(429).json({
      error: 'Too many login attempts',
      message: 'Account temporarily locked. Please try again after 15 minutes.'
    });
  }
});