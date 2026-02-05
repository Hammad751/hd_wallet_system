import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import { derivePath } from 'ed25519-hd-key';
import * as bip39 from 'bip39';
import { BaseChainAdapter } from '../base/BaseChainAdapter';
import { ChainType } from '../../types';

export class SolanaAdapter extends BaseChainAdapter {
  chainType = ChainType.SOLANA;
  private connection: Connection;
  
  constructor(rpcUrl: string) {
    super();
    this.connection = new Connection(rpcUrl, 'confirmed');
  }
  
  async generateAddress(mnemonic: string, index: number) {
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const path = `m/44'/501'/${index}'/0'`;
    const derived = derivePath(path, seed.toString('hex')).key;
    const keypair = Keypair.fromSeed(derived);
    
    return {
      address: keypair.publicKey.toString(),
      publicKey: keypair.publicKey.toString(),
      derivationPath: path
    };
  }
  
  async getBalance(address: string, token?: string): Promise<string> {
    const pubkey = new PublicKey(address);
    
    if (!token) {
      const balance = await this.connection.getBalance(pubkey);
      return (balance / LAMPORTS_PER_SOL).toString();
    } else {
      // SPL Token balance logic would go here
      throw new Error('SPL token balance not implemented');
    }
  }
  
  async transfer(params: {
    fromMnemonic: string;
    fromIndex: number;
    toAddress: string;
    amount: string;
    token?: string;
  }): Promise<string> {
    const seed = await bip39.mnemonicToSeed(params.fromMnemonic);
    const path = `m/44'/501'/${params.fromIndex}'/0'`;
    const derived = derivePath(path, seed.toString('hex')).key;
    const fromKeypair = Keypair.fromSeed(derived);
    
    const toPublicKey = new PublicKey(params.toAddress);
    const lamports = Math.floor(parseFloat(params.amount) * LAMPORTS_PER_SOL);
    
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: toPublicKey,
        lamports
      })
    );
    
    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [fromKeypair]
    );
    
    return signature;
  }
  
  validateAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }
  
  async getTransactionStatus(txHash: string): Promise<'pending' | 'confirmed' | 'failed'> {
    const status = await this.connection.getSignatureStatus(txHash);
    if (!status.value) return 'pending';
    if (status.value.err) return 'failed';
    return status.value.confirmationStatus === 'finalized' ? 'confirmed' : 'pending';
  }
}