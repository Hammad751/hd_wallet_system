CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users table (Updated with is_active and last_login)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,          
    last_login TIMESTAMP WITH TIME ZONE,     
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wallets table
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    encrypted_mnemonic TEXT NOT NULL,
    encryption_iv TEXT NOT NULL,
    encryption_tag TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Addresses table
CREATE TABLE addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    chain VARCHAR(50) NOT NULL,
    network VARCHAR(50) NOT NULL,
    address VARCHAR(255) NOT NULL,
    derivation_path VARCHAR(100) NOT NULL,
    public_key TEXT NOT NULL,
    address_index INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(wallet_id, chain, address_index)
);

-- Transactions table (Updated with network and failed_at)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    from_address VARCHAR(255) NOT NULL,
    to_address VARCHAR(255) NOT NULL,
    chain VARCHAR(50) NOT NULL,
    network VARCHAR(50) NOT NULL,
    token VARCHAR(100),
    amount DECIMAL(36, 18) NOT NULL,
    tx_hash VARCHAR(255) UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP,
    failed_at TIMESTAMP                       
);

-- Hot wallets table (For centralized liquidity)
CREATE TABLE hot_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain VARCHAR(50) NOT NULL,
    address VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chain, address)
);

-- Indexes (Keep your existing ones and add new as needed)
CREATE INDEX idx_addresses_wallet_chain ON addresses(wallet_id, chain);
CREATE INDEX idx_addresses_address ON addresses(address);
CREATE INDEX idx_transactions_from ON transactions(from_address);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);