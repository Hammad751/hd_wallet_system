import express from 'express';
import cors from 'cors';
// import morgan from 'morgan';
import { config } from './config/environment';
// import { stream } from './utils/logger';
import { query, closePool } from './config/database';

// Import middleware
import {
  securityHeaders,
  httpsRedirect,
  corsOptions,
  preventParameterPollution,
  validateContentType,
  requestSizeLimiter,
  requestId,
  apiLimiter,
  // sanitizeInput,
  notFoundHandler,
  errorHandler,
  requestLogger,
  // sensitiveDataLogger
} from './middleware';

// Import routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';        // NEW
import walletRoutes from './routes/wallet.routes';
import transferRoutes from './routes/transfer.routes';
// import adminRoutes from './routes/admin.routes';

//////////////////////// Adapters /////////////////////////
import { ChainAdapterFactory } from './chains';
import { EVMAdapter } from './chains/evm/EVMAdapter';
import { BitcoinAdapter } from './chains/bitcoin/BitcoinAdapter';
import { SolanaAdapter } from './chains/solana/SolanaAdapter';
// import { TONAdapter } from './chains/ton/TONAdapter';

// Initialize chain adapters BEFORE routes
ChainAdapterFactory.registerAdapter('EVM_ethereum', new EVMAdapter(config.rpc.ethereum, 1));
ChainAdapterFactory.registerAdapter('EVM_sepolia', new EVMAdapter(config.rpc.sepolia, 11155111));
ChainAdapterFactory.registerAdapter('EVM_bsc', new EVMAdapter(config.rpc.bsc, 56));
ChainAdapterFactory.registerAdapter('EVM_polygon', new EVMAdapter(config.rpc.polygon, 137));
ChainAdapterFactory.registerAdapter('BITCOIN', new BitcoinAdapter('mainnet'));
ChainAdapterFactory.registerAdapter('SOLANA', new SolanaAdapter(config.rpc.solana));
// ChainAdapterFactory.registerAdapter('TON', new TONAdapter(config.rpc.ton));


const app = express();

// ============================================================================
// SECURITY MIDDLEWARE (Order matters!)
// ============================================================================

// 1. HTTPS redirect (production only)
app.use(httpsRedirect);

// 2. Security headers
app.use(securityHeaders);

// 3. Request ID for tracing
app.use(requestId);

// 4. CORS
app.use(cors(corsOptions));

// 5. Body parsing with size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 6. Request size limiter
app.use(requestSizeLimiter);

// 7. Content type validation
app.use(validateContentType);

// 8. Sanitize input
// app.use(sanitizeInput);

// 9. Parameter pollution prevention
app.use(preventParameterPollution);

// 10. HTTP request logging
// app.use(morgan('combined', { stream }));

// 11. Custom request logger
app.use(requestLogger);

// 12. Sensitive operation logger
// app.use(sensitiveDataLogger);

// 13. API rate limiting
app.use('/api', apiLimiter);

// ============================================================================
// ROUTES
// ============================================================================

// Health check (no auth required)
// Updated Health check in app.ts
app.get('/health', async (_, res) => {
  try {
    // Perform a shallow query to verify DB responsiveness
    await query('SELECT 1');

    return res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
      version: '2.0.0'
    });
  } catch (err) {
    return res.status(503).json({
      status: 'unhealthy',
      database: 'error',
      message: err instanceof Error ? err.message : 'Unknown error'
    });
  }
});

// API Info
app.get('/api/v1', (_, res: express.Response) => {
  res.json({
    name: 'HD Wallet API',
    version: '2.0.0',
    documentation: '/api/v1/docs',
    endpoints: {
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      wallets: '/api/v1/wallet',
      transfers: '/api/v1/transfer',
      admin: '/api/v1/admin'
    }
  });
});

// Authentication routes (no auth required)
app.use('/api/v1/auth', authRoutes);

// User management routes (auth required)
app.use('/api/v1/users', userRoutes);

// Wallet routes (auth required)
app.use('/api/v1', walletRoutes);

// Transfer routes (auth required)
app.use('/api/v1', transferRoutes);

// Admin routes (admin auth required)
// app.use('/api/v1/admin', adminRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ============================================================================
// START SERVER
// ============================================================================

// const PORT = config.port;

const server = async () => {
  try {
    // 1. Test Database Connection
    console.log('⏳ Connecting to PostgreSQL...');
    const result = await query('SELECT NOW() as now');
    console.log(`✅ Database Connected: ${result.rows[0].now}`);

    // 2. Start Express Server
    const PORT = config.port;
    const server = app.listen(PORT, () => {
      console.log('========================================');
      console.log(`🚀 Server running on port ${PORT}`);
      console.log('========================================');
    });

    // ============================================================================
    // UPDATED GRACEFUL SHUTDOWN
    // ============================================================================
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n${signal} signal received: closing server gracefully...`);

      server.close(async () => {
        console.log('HTTP server closed.');

        try {
          // 3. Close the DB Pool
          await closePool();
          console.log('All connections closed. Exiting process.');
          process.exit(0);
        } catch (err) {
          console.error('Error during database shutdown:', err);
          process.exit(1);
        }
      });

      setTimeout(() => {
        console.error('Forceful shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start server:');
    console.error(error);
    process.exit(1);
  }
};

// Execute the startup
server();

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Application specific logging, throwing an error, or other logic here
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  // Perform cleanup and exit
  process.exit(1);
});

export default app;