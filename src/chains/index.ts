import { IChainAdapter } from './base/IChainAdapter';
import { EVMAdapter } from './evm/EVMAdapter';
import { BitcoinAdapter } from './bitcoin/BitcoinAdapter';
import { SolanaAdapter } from './solana/SolanaAdapter';
// import { TONAdapter } from './ton/TONAdapter';
import { ChainType } from '../types';
import { config } from '../config/environment';

export class ChainAdapterFactory {
  private static adapters: Map<string, IChainAdapter> = new Map();
  
  static registerAdapter(key: string, adapter: IChainAdapter) {
    this.adapters.set(key, adapter);
  }
  
  static getAdapter(chain: ChainType, network?: string): IChainAdapter {
    const key = network ? `${chain}_${network}` : chain;
    
    if (!this.adapters.has(key)) {
      // Initialize default adapters
      switch (chain) {
        case ChainType.EVM:
          if (network === 'ethereum') {
            this.adapters.set(key, new EVMAdapter(config.rpc.ethereum, 1));
          } else if (network === 'bsc') {
            this.adapters.set(key, new EVMAdapter(config.rpc.bsc, 56));
          } else if (network === 'polygon') {
            this.adapters.set(key, new EVMAdapter(config.rpc.polygon, 137));
          }
          break;
        case ChainType.BITCOIN:
          this.adapters.set(key, new BitcoinAdapter('mainnet', config.rpc.bitcoin));
          break;
        case ChainType.SOLANA:
          this.adapters.set(key, new SolanaAdapter(config.rpc.solana));
          break;
        // case ChainType.TON:
        //   this.adapters.set(key, new TONAdapter(config.rpc.ton));
        //   break;
      }
    }
    
    const adapter = this.adapters.get(key);
    if (!adapter) {
      throw new Error(`Adapter not found for ${key}`);
    }
    return adapter;
  }
  
  static listAdapters(): string[] {
    return Array.from(this.adapters.keys());
  }
}