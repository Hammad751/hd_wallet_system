import { query } from '../config/database';
import { TransferService } from './TransferService';

export class TransactionWatcher {
  private transferService = new TransferService();

  async start() {
    // Check every 30 seconds
    setInterval(async () => {
      try {
        const pendingTxs = await query(
          "SELECT tx_hash, chain FROM transactions WHERE status = 'pending'"
        );

        for (const row of pendingTxs.rows) {
          console.log(`Checking status for: ${row.tx_hash}`);
          await this.transferService.getTransactionStatus(row.tx_hash, row.chain);
        }
      } catch (err) {
        console.error('Watcher Error:', err);
      }
    }, 30000); 
  }
}