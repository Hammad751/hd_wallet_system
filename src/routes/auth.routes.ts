import { Router } from 'express';
import { body } from 'express-validator';
import { AuthController } from '../controllers/AuthController';
import { 
  authenticate, 
  handleValidationErrors,
  refreshToken,
  asyncHandler
} from '../middleware';

const   router = Router();
const controller = new AuthController();

// ============================================================================
// PUBLIC ROUTES (No authentication required)
// ============================================================================

/**
 * Register a new user
 * POST /api/v1/auth/register
 * 
 * Body:
 * {
 *   "email": "user@example.com",
 *   "password": "SecurePass@123",
 *   "name": "John Doe" (optional)
 * }
 */
router.post(
  '/register',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    
    body('password')
      .isString()
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage(
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)'
      ),
    
    body('name')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Name must be between 1 and 255 characters'),
    
    handleValidationErrors
  ],
  asyncHandler(controller.register)
);

/**
 * Login
 * POST /api/v1/auth/login
 * 
 * Body:
 * {
 *   "email": "user@example.com",
 *   "password": "SecurePass@123"
 * }
 */
router.post(
  '/login',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    
    body('password')
      .isString()
      .notEmpty()
      .withMessage('Password is required'),
    
    handleValidationErrors
  ],
  asyncHandler(controller.login)
);

// ============================================================================
// PROTECTED ROUTES (Authentication required)
// ============================================================================

/**
 * Refresh authentication token
 * POST /api/v1/auth/refresh
 * 
 * Headers:
 * Authorization: Bearer <old_token>
 * 
 * Returns new token in response header: X-New-Token
 */
router.post(
  '/refresh',
  authenticate,
  refreshToken,
  (_, res) => {
    res.json({
      success: true,
      message: 'Token refreshed successfully',
      token: res.getHeader('X-New-Token')
    });
  }
);

/**
 * Logout
 * POST /api/v1/auth/logout
 * 
 * Headers:
 * Authorization: Bearer <token>
 */
router.post(
  '/logout',
  authenticate,
  asyncHandler(controller.logout)
);

/**
 * Get current authenticated user
 * GET /api/v1/auth/me
 * 
 * Headers:
 * Authorization: Bearer <token>
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(controller.getCurrentUser)
);

export default router;

// ============================================================================
// ROUTE SUMMARY
// ============================================================================

/*
PUBLIC ROUTES:
- POST /api/v1/auth/register    - Register new user
- POST /api/v1/auth/login       - Login and get JWT token

PROTECTED ROUTES (require authentication):
- POST /api/v1/auth/refresh     - Refresh JWT token
- POST /api/v1/auth/logout      - Logout (logs event)
- GET  /api/v1/auth/me          - Get current user info

USAGE EXAMPLES:

1. Register:
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass@123",
    "name": "John Doe"
  }'

2. Login:
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass@123"
  }'

Response:
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}

3. Get current user:
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"

4. Refresh token:
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Authorization: Bearer YOUR_OLD_TOKEN"

5. Logout:
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Authorization: Bearer YOUR_TOKEN"
*/