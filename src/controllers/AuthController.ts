import { Response } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../config/database';
import { AuthRequest, generateToken } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { ValidationError, AuthenticationError, ConflictError } from '../middleware/error.middleware';

export class AuthController {
  async register(req: AuthRequest, res: Response) {
    const { email, password, name } = req.body;
    
    try {
      // Check if user already exists
      const existingUser = await query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );
      
      if (existingUser.rows.length > 0) {
        throw new ConflictError('User already exists with this email');
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);
      
      // Create user
      const result = await query(
        `INSERT INTO users (email, password, name, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, name, role, created_at`,
        [email, hashedPassword, name || null, 'user']
      );
      
      const user = result.rows[0];
      
      // Generate token
      const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role
      });
      
      logger.info('User registered', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });
      
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            createdAt: user.created_at
          },
          token
        }
      });
    } catch (error: any) {
      logger.error('Registration error', {
        error: error.message,
        email
      });
      throw error;
    }
  }
  
  async login(req: AuthRequest, res: Response) {
    const { email, password } = req.body;
    
    try {
      // Get user
      const result = await query(
        `SELECT id, email, password, name, role, is_active
         FROM users 
         WHERE email = $1`,
        [email]
      );
      
      if (result.rows.length === 0) {
        logger.warn('Login attempt with non-existent email', {
          email,
          ip: req.ip
        });
        throw new AuthenticationError('Invalid credentials');
      }
      
      const user = result.rows[0];
      
      // Check if account is active
      if (!user.is_active) {
        logger.warn('Login attempt on inactive account', {
          userId: user.id,
          email,
          ip: req.ip
        });
        throw new AuthenticationError('Account is inactive');
      }
      
      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        logger.warn('Login attempt with invalid password', {
          email,
          ip: req.ip
        });
        
        // Log failed attempt
        await query(
          `INSERT INTO login_attempts (user_id, success, ip_address)
           VALUES ($1, $2, $3)`,
          [user.id, false, req.ip]
        );
        
        throw new AuthenticationError('Invalid credentials');
      }
      
      // Generate token
      const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role
      });
      
      // Log successful login
      await query(
        `INSERT INTO login_attempts (user_id, success, ip_address)
         VALUES ($1, $2, $3)`,
        [user.id, true, req.ip]
      );
      
      // Update last login
      await query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [user.id]
      );
      
      logger.info('User logged in', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });
      
      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
          },
          token
        }
      });
    } catch (error: any) {
      logger.error('Login error', {
        error: error.message,
        email
      });
      throw error;
    }
  }
  
  async logout(req: AuthRequest, res: Response) {
    // In JWT, logout is handled client-side by removing token
    // But we can log the event
    logger.info('User logged out', {
      userId: req.user?.id,
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  }
  
  async getCurrentUser(req: AuthRequest, res: Response) {
    if (!req.user) {
      throw new AuthenticationError();
    }
    
    const result = await query(
      `SELECT id, email, name, role, created_at, last_login
       FROM users 
       WHERE id = $1`,
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      throw new AuthenticationError('User not found');
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  }
}
