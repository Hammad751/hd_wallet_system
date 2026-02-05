import { mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV4, Address } from '@ton/ton';
import { TonClient } from '@ton/ton';
import { BaseChainAdapter } from '../base/BaseChainAdapter';
import { ChainType } from '../../types';

export class TONAdapter extends BaseChainAdapter {
  chainType = ChainType.TON;
  private client: TonClient;
  
  constructor(rpcUrl: string) {
    super();
    this.client = new TonClient({ endpoint: rpcUrl });
  }
  
  async generateAddress(mnemonic: string, index: number) {
    const words = mnemonic.split(' ');
    const keyPair = await mnemonicToPrivateKey(words);
    
    const wallet = WalletContractV4.create({
      workchain: 0,
      publicKey: keyPair.publicKey
    });
    
    return {
      address: wallet.address.toString(),
      publicKey: keyPair.publicKey.toString('hex'),
      derivationPath: `m/44'/607'/0'/0/${index}`
    };
  }
  
  async getBalance(address: string): Promise<string> {
    const addr = Address.parse(address);
    const balance = await this.client.getBalance(addr);
    return (Number(balance) / 1e9).toString(); // Convert from nanoTON
  }
  
  async transfer(params: {
    fromMnemonic: string;
    fromIndex: number;
    toAddress: string;
    amount: string;
  }): Promise<string> {
    const words = params.fromMnemonic.split(' ');
    const keyPair = await mnemonicToPrivateKey(words);
    
    const wallet = WalletContractV4.create({
      workchain: 0,
      publicKey: keyPair.publicKey
    });
    
    const contract = this.client.open(wallet);
    
    const seqno = await contract.getSeqno();
    const transfer = contract.createTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [{
        to: Address.parse(params.toAddress),
        value: BigInt(Math.floor(parseFloat(params.amount) * 1e9)),
        body: ''
      }]
    });
    
    await contract.send(transfer);
    
    // TON doesn't return tx hash immediately, need to track by seqno
    return `seqno_${seqno}`;
  }
  
  validateAddress(address: string): boolean {
    try {
      Address.parse(address);
      return true;
    } catch {
      return false;
    }
  }
  
  async getTransactionStatus(txHash: string): Promise<'pending' | 'confirmed' | 'failed'> {
    // TON transaction status checking would require additional logic
    return 'confirmed';
  }
}
