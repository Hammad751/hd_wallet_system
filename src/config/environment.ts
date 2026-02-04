import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'hd_wallet_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  },
  
  encryption: {
    key: process.env.ENCRYPTION_KEY || '', // Must be 32 bytes
    algorithm: 'aes-256-gcm'
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: '24h'
  },
  
  rpc: {
    ethereum: process.env.ETHEREUM_RPC || '',
    sepolia: process.env.RPC_SEPOLIA || '',
    bsc: process.env.BSC_RPC || '',
    polygon: process.env.POLYGON_RPC || '',
    bitcoin: process.env.BITCOIN_RPC || '',
    solana: process.env.SOLANA_RPC || '',
    ton: process.env.TON_RPC || ''
  }
};
