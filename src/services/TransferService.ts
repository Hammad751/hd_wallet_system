import { query } from '../config/database';
import { EncryptionService } from '../utils/encryption';
import { ChainAdapterFactory } from '../chains';
import { TransferRequest } from '../types';

export class TransferService {
  async transfer(request: TransferRequest): Promise<string> {
    // Get wallet info from address
    const addressResult = await query(
      `SELECT a.*, w.encrypted_mnemonic, w.encryption_iv, w.encryption_tag
       FROM addresses a
       JOIN wallets w ON a.wallet_id = w.id
       WHERE a.address = $1 AND a.chain = $2`,
      [request.fromAddress, request.chain]
    );
    
    if (addressResult.rows.length === 0) {
      throw new Error('Address not found');
    }
    
    const addressInfo = addressResult.rows[0];
    
    // Decrypt mnemonic
    const mnemonic = EncryptionService.decrypt(
      addressInfo.encrypted_mnemonic,
      addressInfo.encryption_iv,
      addressInfo.encryption_tag
    );
    
    // Get adapter and perform transfer
    const adapter = ChainAdapterFactory.getAdapter(
      request.chain,
      addressInfo.network
    );
    
    const txHash = await adapter.transfer({
      fromMnemonic: mnemonic,
      fromIndex: addressInfo.address_index,
      toAddress: request.toAddress,
      amount: request.amount,
      token: request.token
    });
    
    // Record transaction
    await query(
      `INSERT INTO transactions 
       (from_address, to_address, chain, token, amount, tx_hash, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        request.fromAddress,
        request.toAddress,
        request.chain,
        request.token || null,
        request.amount,
        txHash,
        'pending'
      ]
    );
    
    return txHash;
  }
  
  async getTransactionStatus(txHash: string, chain: string) {
    const txResult = await query(
      `SELECT * FROM transactions WHERE tx_hash = $1`,
      [txHash]
    );
    
    if (txResult.rows.length === 0) {
      throw new Error('Transaction not found');
    }

    console.log(`Chain == ${chain}`);
    
    const tx = txResult.rows[0];
    const adapter = ChainAdapterFactory.getAdapter(tx.chain);
    const status = await adapter.getTransactionStatus(txHash);
    
    // Update status if changed
    if (status !== tx.status) {
      await query(
        `UPDATE transactions 
         SET status = $1, confirmed_at = CASE WHEN $1 = 'confirmed' THEN NOW() ELSE NULL END
         WHERE tx_hash = $2`,
        [status, txHash]
      );
    }
    
    return { ...tx, status };
  }
}