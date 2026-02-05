# HD Wallet System for CEX

A professional, production-ready multi-chain HD wallet system with support for EVM chains, Bitcoin, Solana, and TON.

## Features

- 🔐 **Secure HD Wallet Generation**: BIP39/BIP44 compliant
- 🌐 **Multi-Chain Support**: EVM, Bitcoin, Solana, TON
- 🔄 **Easy Chain Addition**: Plugin architecture for new chains
- 💾 **PostgreSQL Storage**: Encrypted mnemonic storage
- 🚀 **RESTful API**: Clean, documented endpoints
- 💸 **Auto-Flush**: Automatic token sweeping to hot wallets
- 📊 **Transaction Tracking**: Complete audit trail

## Supported Chains

| Chain | Networks | Status |
|-------|----------|--------|
| EVM | Ethereum, BSC, Polygon, Arbitrum, etc. | ✅ Ready |
| Bitcoin | Mainnet, Testnet | ✅ Ready |
| Solana | Mainnet, Devnet | ✅ Ready |
| TON | Mainnet | ✅ Ready |

## Installation

### Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 14
- npm or yarn

### Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd hd-wallet-system
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Generate encryption key**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy output to ENCRYPTION_KEY in .env
```

5. **Setup database**
```bash
createdb hd_wallet_db
npm run migrate
```

6. **Run the application**
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## API Documentation

### Base URL
```
http://localhost:3000/api/v1
```

### 1. Create Wallet

**POST** `/wallet`

Creates a new HD wallet for a user with addresses for specified chains.

**Request:**
```json
{
  "userId": "user123",
  "chains": ["EVM", "BITCOIN", "SOLANA", "TON"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user123",
    "addresses": [
      {
        "chain": "EVM",
        "network": "mainnet",
        "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        "derivationPath": "m/44'/60'/0'/0/0",
        "publicKey": "0x..."
      },
      {
        "chain": "BITCOIN",
        "network": "mainnet",
        "address": "bc1q...",
        "derivationPath": "m/84'/0'/0'/0/0",
        "publicKey": "02..."
      }
    ]
  }
}
```

### 2. Get Wallet

**GET** `/wallet/:userId`

Retrieves wallet information and all addresses for a user.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "user123",
    "addresses": [...],
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### 3. Generate New Address

**POST** `/wallet/:userId/address`

Generates a new address for a specific chain (useful for deposit addresses).

**Request:**
```json
{
  "chain": "EVM",
  "network": "ethereum"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "chain": "EVM",
    "network": "ethereum",
    "address": "0x...",
    "derivationPath": "m/44'/60'/0'/0/1",
    "publicKey": "0x..."
  }
}
```

### 4. Transfer Tokens

**POST** `/transfer`

Transfers tokens from one address to another.

**Request:**
```json
{
  "fromAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "toAddress": "0x1234...",
  "amount": "1.5",
  "chain": "EVM",
  "token": "0xUSDT..." // Optional, omit for native token
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "txHash": "0xabc123..."
  }
}
```

### 5. Get Transaction Status

**GET** `/transfer/:txHash/status?chain=EVM`

Checks the status of a transaction.

**Response:**
```json
{
  "success": true,
  "data": {
    "from_address": "0x...",
    "to_address": "0x...",
    "amount": "1.5",
    "status": "confirmed",
    "tx_hash": "0xabc123...",
    "confirmed_at": "2024-01-15T10:35:00Z"
  }
}
```

### 6. Flush to Hot Wallet

**POST** `/flush`

Sweeps tokens from multiple user addresses to a hot wallet.

**Request:**
```json
{
  "userAddresses": ["0xaddr1...", "0xaddr2...", "0xaddr3..."],
  "hotWalletAddress": "0xHotWallet...",
  "chain": "EVM",
  "token": null // Optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "txHashes": ["0xhash1...", "0xhash2..."],
    "count": 2
  }
}
```

## Adding a New Chain

The system is designed to easily support new chains. Here's how:

### 1. Create Chain Adapter

Create a new file in `src/chains/yourchain/YourChainAdapter.ts`:

```typescript
import { BaseChainAdapter } from '../base/BaseChainAdapter';
import { ChainType } from '../../types';

export class YourChainAdapter extends BaseChainAdapter {
  chainType = ChainType.YOUR_CHAIN;
  
  async generateAddress(mnemonic: string, index: number) {
    // Implement address generation
    return {
      address: '...',
      publicKey: '...',
      derivationPath: '...'
    };
  }
  
  async getBalance(address: string, token?: string): Promise<string> {
    // Implement balance checking
  }
  
  async transfer(params: any): Promise<string> {
    // Implement transfer
  }
  
  validateAddress(address: string): boolean {
    // Implement address validation
  }
  
  async getTransactionStatus(txHash: string) {
    // Implement status checking
  }
}
```

### 2. Register the Adapter

In `src/chains/index.ts`, add to `ChainAdapterFactory`:

```typescript
case ChainType.YOUR_CHAIN:
  this.adapters.set(key, new YourChainAdapter(config.rpc.yourchain));
  break;
```

### 3. Update Types

Add to `src/types/index.ts`:

```typescript
export enum ChainType {
  // ... existing chains
  YOUR_CHAIN = 'YOUR_CHAIN'
}
```

That's it! Your new chain is now supported.

## Security Best Practices

1. **Environment Variables**: Never commit `.env` file
2. **Encryption Key**: Use a cryptographically secure 32-byte key
3. **Database**: Use SSL for production database connections
4. **API**: Implement JWT authentication and rate limiting
5. **Hot Wallets**: Keep minimal funds, use cold storage for bulk
6. **Monitoring**: Set up alerts for large transactions
7. **Backups**: Regular encrypted backups of the database

## Production Checklist

- [ ] Enable database SSL
- [ ] Implement JWT authentication middleware
- [ ] Add rate limiting (express-rate-limit)
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Configure log aggregation (ELK Stack)
- [ ] Enable HTTPS/TLS
- [ ] Set up automated backups
- [ ] Implement 2FA for admin operations
- [ ] Add IP whitelisting for sensitive endpoints
- [ ] Configure firewall rules
- [ ] Set up alerting system
- [ ] Perform security audit

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  API Layer      │
│  (Controllers)  │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Service Layer   │
│ (Business Logic)│
└──────┬──────────┘
       │
       ├──────────────┐
       ▼              ▼
┌─────────────┐  ┌──────────────┐
│  Database   │  │ Chain        │
│  (Postgres) │  │ Adapters     │
└─────────────┘  └──────┬───────┘
                        │
                        ▼
                 ┌──────────────┐
                 │ Blockchain   │
                 │ Networks     │
                 └──────────────┘
```

## Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage
```

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.