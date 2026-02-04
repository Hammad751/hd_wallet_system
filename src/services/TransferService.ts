import { query } from '../config/database';
import { EncryptionService } from '../utils/encryption';
import { ChainAdapterFactory } from '../chains';
import { TransferRequest } from '../types';

export class TransferService {

  async transfer(request: TransferRequest): Promise<string> {
    // 1. Fetch info (Existing logic is good)
    const addressInfo = await this.getAddressWithWallet(request.fromAddress, request.chain);

    // 2. Pre-check Balance + Gas (MISSING)
    const adapter = ChainAdapterFactory.getAdapter(request.chain, addressInfo.network);
    const balance = await adapter.getBalance(request.fromAddress);
    if (parseFloat(balance) < parseFloat(request.amount)) {
      throw new Error("Insufficient funds for transfer and gas");
    }

    const mnemonic = EncryptionService.decrypt(
      addressInfo.encrypted_mnemonic,
      addressInfo.encryption_iv,
      addressInfo.encryption_tag
    );
    // 4. Perform Transfer
    const txHash = await adapter.transfer({
      fromMnemonic: mnemonic,
      fromIndex: addressInfo.address_index,
      toAddress: request.toAddress,
      amount: request.amount,
      token: request.token
    });


    // 5. Record with more detail
    // await query(
    //   `INSERT INTO transactions 
    //    (user_id, from_address, to_address, chain, amount, tx_hash, status, created_at)
    //    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
    //   [addressInfo.user_id, request.fromAddress, request.toAddress, request.chain, request.amount, txHash, 'pending']
    // );

    await query(
      `INSERT INTO transactions 
   (user_id, from_address, to_address, chain, network, token, amount, tx_hash, status)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        addressInfo.user_id,
        request.fromAddress,
        request.toAddress,
        request.chain,
        addressInfo.network,
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

  private async getAddressWithWallet(address: string, chain: string) {
    const result = await query(
      `SELECT 
        a.id as address_id,
        a.address,
        a.address_index,
        a.chain,
        a.network,
        w.id as wallet_id,
        w.user_id,
        w.encrypted_mnemonic,
        w.encryption_iv,
        w.encryption_tag
       FROM addresses a
       JOIN wallets w ON a.wallet_id = w.id
       WHERE a.address = $1 AND a.chain = $2`,
      [address, chain]
    );

    if (result.rows.length === 0) {
      throw new Error('Address not found or does not belong to a valid wallet');
    }

    return result.rows[0];
  }
}