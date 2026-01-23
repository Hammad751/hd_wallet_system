import * as bip39 from 'bip39';
import { query } from '../config/database';
import { EncryptionService } from '../utils/encryption';
import { ChainAdapterFactory } from '../chains';
import { ChainType, WalletConfig, GeneratedWallet } from '../types';

export class WalletService {
  async createWallet(config: WalletConfig): Promise<GeneratedWallet> {
    // Generate mnemonic
    const mnemonic = bip39.generateMnemonic(256); // 24 words
    
    // Encrypt mnemonic
    const { encrypted, iv, tag } = EncryptionService.encrypt(mnemonic);
    
    // Store wallet in database
    const walletResult = await query(
      `INSERT INTO wallets (user_id, encrypted_mnemonic, encryption_iv, encryption_tag)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [config.userId, encrypted, iv, tag]
    );
    
    const walletId = walletResult.rows[0].id;
    
    // Generate addresses for each chain
    const addresses = [];
    for (const chain of config.chains) {
      const address = await this.generateAddressForChain(
        walletId,
        mnemonic,
        chain,
        0 // Initial index
      );
      addresses.push(address);
    }
    
    return {
      userId: config.userId,
      mnemonic: encrypted, // Return encrypted for security
      addresses
    };
  }
  
  private async generateAddressForChain(
    walletId: string,
    mnemonic: string,
    chain: ChainType,
    index: number,
    network?: string
  ) {
    const adapter = ChainAdapterFactory.getAdapter(chain, network);
    const generated = await adapter.generateAddress(mnemonic, index);
    
    // Store address in database
    await query(
      `INSERT INTO addresses 
       (wallet_id, chain, network, address, derivation_path, public_key, address_index)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        walletId,
        chain,
        network || 'mainnet',
        generated.address,
        generated.derivationPath,
        generated.publicKey,
        index
      ]
    );
    
    return {
      chain,
      network: network || 'mainnet',
      address: generated.address,
      derivationPath: generated.derivationPath,
      publicKey: generated.publicKey
    };
  }
  
  async getWalletByUserId(userId: string) {
    const result = await query(
      `SELECT w.*, array_agg(
        json_build_object(
          'chain', a.chain,
          'network', a.network,
          'address', a.address,
          'derivation_path', a.derivation_path
        )
      ) as addresses
       FROM wallets w
       LEFT JOIN addresses a ON w.id = a.wallet_id
       WHERE w.user_id = $1
       GROUP BY w.id`,
      [userId]
    );
    
    return result.rows[0] || null;
  }
  
  async generateNewAddress(
    userId: string,
    chain: ChainType,
    network?: string
  ) {
    const wallet = await this.getWalletByUserId(userId);
    if (!wallet) throw new Error('Wallet not found');
    
    // Get current max index for this chain
    const indexResult = await query(
      `SELECT COALESCE(MAX(address_index), -1) + 1 as next_index
       FROM addresses
       WHERE wallet_id = $1 AND chain = $2`,
      [wallet.id, chain]
    );
    
    const nextIndex = indexResult.rows[0].next_index;
    
    // Decrypt mnemonic
    const mnemonic = EncryptionService.decrypt(
      wallet.encrypted_mnemonic,
      wallet.encryption_iv,
      wallet.encryption_tag
    );
    
    return this.generateAddressForChain(
      wallet.id,
      mnemonic,
      chain,
      nextIndex,
      network
    );
  }
}