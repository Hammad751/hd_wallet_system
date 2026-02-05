import { ChainType } from '../../types';

export interface IChainAdapter {
  chainType: ChainType;
  
  // Generate address from mnemonic
  generateAddress(mnemonic: string, index: number): Promise<{
    address: string;
    publicKey: string;
    derivationPath: string;
  }>;
  
  // Get balance
  getBalance(address: string, token?: string): Promise<string>;
  
  // Transfer tokens
  transfer(params: {
    fromMnemonic: string;
    fromIndex: number;
    toAddress: string;
    amount: string;
    token?: string;
  }): Promise<string>; // returns tx hash
  
  // Validate address
  validateAddress(address: string): boolean;
  
  // Get transaction status
  getTransactionStatus(txHash: string): Promise<'pending' | 'confirmed' | 'failed'>;
}
