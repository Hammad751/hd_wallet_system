
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import walletRoutes from './routes/wallet.routes';
// import transferRoutes from './routes/transfer.routes';
import { config } from './config/environment';
import fs from 'fs';
import { query } from './config/database';
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/v1', walletRoutes);
// app.use('/api/v1', transferRoutes);

// // Health check
// app.get('/health', (req, res) => {
//   return res.json({ status: 'ok', timestamp: new Date().toISOString() });
// });

// Error handler
// app.use((err: any, req: any, res: any, next: any) => {
//   console.error(err.stack);
//   return res.status(500).json({ 
//     error: 'Internal server error',
//     message: process.env.NODE_ENV === 'development' ? err.message : undefined
//   });
// });

const PORT = config.port;

// app.listen(PORT, () => {
//   console.log(`🚀 HD Wallet API running on port ${PORT}`);
//   console.log(`📊 Environment: ${config.nodeEnv}`);
// });


const startServer = async () => {
  try {
    // 1. Run migrations first
    const migrationSql = fs.readFileSync('./migrations/001_initial_schema.sql', 'utf8');
    await query(migrationSql);
    console.log('🚀 Database schema synced.');

    // 2. Then start Express
    app.listen(PORT, () => {
      console.log(`🚀 API running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Migration/Startup Error:', err);
  }
};

startServer();

export default app;
