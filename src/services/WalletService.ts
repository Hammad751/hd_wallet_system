import * as bip39 from 'bip39';
import { query } from '../config/database';
import { EncryptionService } from '../utils/encryption';
import { ChainAdapterFactory } from '../chains';
import { ChainType, WalletConfig, GeneratedWallet } from '../types';

export class WalletService {
  async createWallet(config: WalletConfig): Promise<GeneratedWallet> {
    // Generate mnemonic
    const mnemonic = bip39.generateMnemonic(256); // 24 words
    console.log("mnemonic generated", mnemonic, config);


    // Encrypt mnemonic
    const { encrypted, iv, tag } = EncryptionService.encrypt(mnemonic);
    console.log("encrypted, iv, tag");

    const existingWallet = await query(
      'SELECT id FROM wallets WHERE user_id = $1',
      [config.userId]
    );

    let walletId;


    if (existingWallet.rows.length > 0) {
      // User already has a wallet, use existing one
      walletId = existingWallet.rows[0].id;
    } else {
      // Create new wallet
      const walletResult = await query(
        `INSERT INTO wallets (user_id, encrypted_mnemonic, encryption_iv, encryption_tag)
       VALUES ($1, $2, $3, $4) RETURNING id`,
        [config.userId, encrypted, iv, tag]
      );
      walletId = walletResult.rows[0].id;
    }

    // Generate addresses for each chain
    const addresses = [];
    for (const chainConfig of config.chains) {
      const chain = typeof chainConfig === 'string' ? chainConfig : chainConfig.chain;
      const network = typeof chainConfig === 'object' ? chainConfig.network : 'ethereum';

      console.log("chain or network: ", chain, network);

      const address = await this.generateAddressForChain(
        walletId,
        mnemonic,
        chain,
        0,
        network
      );
      addresses.push(address);

    }
    console.log("addresses generated", addresses);
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
    console.log("before adapter", chain, network);
    const adapter = ChainAdapterFactory.getAdapter(chain, network);
    console.log("adapter: ", adapter);

    const generated = await adapter.generateAddress(mnemonic, index);
    console.log("generated address: ", generated, walletId, chain, network, index);
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
       WHERE wallet_id = $1 AND chain = $2 AND network = $3`,
      [wallet.id, chain, network || 'mainnet']
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