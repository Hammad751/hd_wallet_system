// ============================================================================
// FILE: src/routes/user.routes.ts
// ============================================================================

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { UserController } from '../controllers/UserController';
import {
  authenticate,
  // authorizeUser,
  requireAdmin,
  handleValidationErrors,
  asyncHandler,
  // apiLimiter
} from '../middleware';

const router = Router();
const controller = new UserController();

// ============================================================================
// PUBLIC ROUTES (No authentication required)
// ============================================================================

// None - all user routes require authentication

// ============================================================================
// USER ROUTES (Authentication required)
// ============================================================================

/**
 * Get current user profile
 * GET /api/v1/users/me
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(controller.getProfile)
);

/**
 * Update current user profile
 * PUT /api/v1/users/me
 */
router.put(
  '/me',
  authenticate,
  [
    body('name')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Name must be 1-255 characters'),
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Invalid email format'),
    handleValidationErrors
  ],
  asyncHandler(controller.updateProfile)
);

/**
 * Change password
 * PUT /api/v1/users/me/password
 */
router.put(
  '/me/password',
  authenticate,
  [
    body('currentPassword')
      .isString()
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isString()
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage(
        'New password must be at least 8 characters with uppercase, lowercase, number, and special character'
      ),
    body('newPassword')
      .custom((value, { req }) => value !== req.body.currentPassword)
      .withMessage('New password must be different from current password'),
    handleValidationErrors
  ],
  asyncHandler(controller.changePassword)
);

/**
 * Deactivate own account
 * DELETE /api/v1/users/me
 */
router.delete(
  '/me',
  authenticate,
  [
    body('password')
      .isString()
      .notEmpty()
      .withMessage('Password confirmation required'),
    handleValidationErrors
  ],
  asyncHandler(controller.deactivateAccount)
);

/**
 * Get user by ID (self or admin)
 * GET /api/v1/users/:userId
 */
router.get(
  '/:userId',
  authenticate,
  [
    param('userId')
      .isUUID()
      .withMessage('Invalid user ID'),
    handleValidationErrors
  ],
  asyncHandler(controller.getUserById)
);

/**
 * Get user activity history
 * GET /api/v1/users/:userId/activity
 */
router.get(
  '/:userId/activity',
  authenticate,
  [
    param('userId')
      .isUUID()
      .withMessage('Invalid user ID'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    handleValidationErrors
  ],
  asyncHandler(controller.getUserActivity)
);

/**
 * Get user statistics
 * GET /api/v1/users/:userId/stats
 */
router.get(
  '/:userId/stats',
  authenticate,
  [
    param('userId')
      .isUUID()
      .withMessage('Invalid user ID'),
    handleValidationErrors
  ],
  asyncHandler(controller.getUserStats)
);

// ============================================================================
// ADMIN ROUTES (Admin authentication required)
// ============================================================================

/**
 * Get all users
 * GET /api/v1/users
 */
router.get(
  '/',
  authenticate,
  requireAdmin,
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('search')
      .optional()
      .isString()
      .trim()
      .withMessage('Search must be a string'),
    query('role')
      .optional()
      .isIn(['user', 'admin'])
      .withMessage('Role must be user or admin'),
    query('status')
      .optional()
      .isIn(['active', 'inactive'])
      .withMessage('Status must be active or inactive'),
    handleValidationErrors
  ],
  asyncHandler(controller.getAllUsers)
);

/**
 * Update user status (activate/deactivate)
 * PATCH /api/v1/users/:userId/status
 */
router.patch(
  '/:userId/status',
  authenticate,
  requireAdmin,
  [
    param('userId')
      .isUUID()
      .withMessage('Invalid user ID'),
    body('isActive')
      .isBoolean()
      .withMessage('isActive must be a boolean'),
    handleValidationErrors
  ],
  asyncHandler(controller.updateUserStatus)
);

/**
 * Update user role
 * PATCH /api/v1/users/:userId/role
 */
router.patch(
  '/:userId/role',
  authenticate,
  requireAdmin,
  [
    param('userId')
      .isUUID()
      .withMessage('Invalid user ID'),
    body('role')
      .isIn(['user', 'admin'])
      .withMessage('Role must be user or admin'),
    handleValidationErrors
  ],
  asyncHandler(controller.updateUserRole)
);

/**
 * Delete user permanently
 * DELETE /api/v1/users/:userId
 */
router.delete(
  '/:userId',
  authenticate,
  requireAdmin,
  [
    param('userId')
      .isUUID()
      .withMessage('Invalid user ID'),
    handleValidationErrors
  ],
  asyncHandler(controller.deleteUser)
);

export default router;

// ============================================================================
// ROUTE SUMMARY
// ============================================================================

/*
USER ROUTES (Authenticated):
- GET    /api/v1/users/me                  - Get own profile
- PUT    /api/v1/users/me                  - Update own profile
- PUT    /api/v1/users/me/password         - Change password
- DELETE /api/v1/users/me                  - Deactivate own account
- GET    /api/v1/users/:userId             - Get user by ID (self/admin)
- GET    /api/v1/users/:userId/activity    - Get user activity
- GET    /api/v1/users/:userId/stats       - Get user statistics

ADMIN ROUTES:
- GET    /api/v1/users                     - Get all users
- PATCH  /api/v1/users/:userId/status      - Activate/deactivate user
- PATCH  /api/v1/users/:userId/role        - Change user role
- DELETE /api/v1/users/:userId             - Delete user permanently
*/