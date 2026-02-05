import { IChainAdapter } from './IChainAdapter';
import { ChainType } from '../../types';

export abstract class BaseChainAdapter implements IChainAdapter {
  abstract chainType: ChainType;
  
  abstract generateAddress(mnemonic: string, index: number): Promise<{
    address: string;
    publicKey: string;
    derivationPath: string;
  }>;
  
  abstract getBalance(address: string, token?: string): Promise<string>;
  
  abstract transfer(params: {
    fromMnemonic: string;
    fromIndex: number;
    toAddress: string;
    amount: string;
    token?: string;
  }): Promise<string>;
  
  abstract validateAddress(address: string): boolean;
  
  abstract getTransactionStatus(txHash: string): Promise<'pending' | 'confirmed' | 'failed'>;
  
  protected async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}