import { query } from '../config/database';
import { TransferService } from './TransferService';
import { ChainAdapterFactory } from '../chains';
import { FlushRequest, ChainType } from '../types';

export class FlushService {
  private transferService: TransferService;
  
  constructor() {
    this.transferService = new TransferService();
  }
  
  async flushToHotWallet(request: FlushRequest): Promise<string[]> {
    const txHashes: string[] = [];
    const minBalance = 0.001; // Minimum balance to flush
    
    for (const userAddress of request.userAddresses) {
      try {
        // Get balance
        const adapter = ChainAdapterFactory.getAdapter(request.chain);
        const balance = parseFloat(
          await adapter.getBalance(userAddress, request.token)
        );
        
        if (balance < minBalance) {
          console.log(`Skipping ${userAddress}: balance too low`);
          continue;
        }
        
        // Calculate amount (leave small amount for gas if native token)
        let amountToFlush = balance;
        if (!request.token) {
          // Reserve gas fee
          const gasFee = this.estimateGasFee(request.chain);
          amountToFlush = balance - gasFee;
          
          if (amountToFlush <= 0) {
            console.log(`Skipping ${userAddress}: insufficient balance after gas`);
            continue;
          }
        }
        
        // Perform transfer
        const txHash = await this.transferService.transfer({
          fromAddress: userAddress,
          toAddress: request.hotWalletAddress,
          amount: amountToFlush.toString(),
          chain: request.chain,
          token: request.token
        });
        
        txHashes.push(txHash);
        console.log(`Flushed ${amountToFlush} from ${userAddress}: ${txHash}`);
        
      } catch (error) {
        console.error(`Error flushing ${userAddress}:`, error);
      }
    }
    
    return txHashes;
  }
  
  private estimateGasFee(chain: ChainType): number {
    // Simple gas fee estimation
    switch (chain) {
      case ChainType.EVM:
        return 0.001; // ~0.001 ETH
      case ChainType.BITCOIN:
        return 0.0001; // ~0.0001 BTC
      case ChainType.SOLANA:
        return 0.00001; // ~0.00001 SOL
      case ChainType.TON:
        return 0.01; // ~0.01 TON
      default:
        return 0.001;
    }
  }
  
  async scheduleAutoFlush(
    chain: ChainType,
    intervalMinutes: number = 60
  ) {
    setInterval(async () => {
      try {
        // Get hot wallet for this chain
        const hotWalletResult = await query(
          `SELECT address FROM hot_wallets 
           WHERE chain = $1 AND is_active = true 
           LIMIT 1`,
          [chain]
        );
        
        if (hotWalletResult.rows.length === 0) {
          console.log(`No active hot wallet for ${chain}`);
          return;
        }
        
        const hotWallet = hotWalletResult.rows[0].address;
        
        // Get all user addresses for this chain
        const addressesResult = await query(
          `SELECT address FROM addresses WHERE chain = $1`,
          [chain]
        );
        
        const addresses = addressesResult.rows.map(r => r.address);
        
        await this.flushToHotWallet({
          userAddresses: addresses,
          hotWalletAddress: hotWallet,
          chain
        });
        
      } catch (error) {
        console.error(`Auto-flush error for ${chain}:`, error);
      }
    }, intervalMinutes * 60 * 1000);
  }
}
