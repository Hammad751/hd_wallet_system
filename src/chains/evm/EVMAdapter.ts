import { ethers } from 'ethers';
import { BaseChainAdapter } from '../base/BaseChainAdapter';
import { ChainType } from '../../types';

export class EVMAdapter extends BaseChainAdapter {
  chainType = ChainType.EVM;
  private provider: ethers.JsonRpcProvider;
  private chainId: number;
  
  constructor(rpcUrl: string, chainId: number) {
    super();
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.chainId = chainId;
  }
  
  async generateAddress(mnemonic: string, index: number) {
    const path = `m/44'/60'/0'/0/${index}`;
    const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, path);
    
    return {
      address: wallet.address,
      publicKey: wallet.publicKey,
      derivationPath: path
    };
  }

  async getChainId(): Promise<number> {
    return this.chainId;
  }
  
  async getBalance(address: string, token?: string): Promise<string> {
    if (!token) {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } else {
      const erc20 = new ethers.Contract(
        token,
        ['function balanceOf(address) view returns (uint256)'],
        this.provider
      );
      const balance = await erc20.balanceOf(address);
      return ethers.formatUnits(balance, 18);
    }
  }
  
  async transfer(params: {
    fromMnemonic: string;
    fromIndex: number;
    toAddress: string;
    amount: string;
    token?: string;
  }): Promise<string> {
    const path = `m/44'/60'/0'/0/${params.fromIndex}`;
    const wallet = ethers.HDNodeWallet.fromPhrase(
      params.fromMnemonic,
      undefined,
      path
    ).connect(this.provider);
    
    let tx;
    if (!params.token) {
      tx = await wallet.sendTransaction({
        to: params.toAddress,
        value: ethers.parseEther(params.amount)
      });
    } else {
      const erc20 = new ethers.Contract(
        params.token,
        ['function transfer(address,uint256) returns (bool)'],
        wallet
      );
      tx = await erc20.transfer(
        params.toAddress,
        ethers.parseUnits(params.amount, 18)
      );
    }
    
    return tx.hash;
  }
  
  validateAddress(address: string): boolean {
    return ethers.isAddress(address);
  }
  
  async getTransactionStatus(txHash: string): Promise<'pending' | 'confirmed' | 'failed'> {
    const receipt = await this.provider.getTransactionReceipt(txHash);
    if (!receipt) return 'pending';
    return receipt.status === 1 ? 'confirmed' : 'failed';
  }
}