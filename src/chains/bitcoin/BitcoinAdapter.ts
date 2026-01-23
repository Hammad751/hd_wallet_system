import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { BaseChainAdapter } from '../base/BaseChainAdapter';
import { ChainType } from '../../types';
import axios from 'axios';

const bip32 = BIP32Factory(ecc);

export class BitcoinAdapter extends BaseChainAdapter {
  chainType = ChainType.BITCOIN;
  private network: bitcoin.Network;
  private apiUrl: string;
  
  constructor(network: 'mainnet' | 'testnet' = 'mainnet', apiUrl?: string) {
    super();
    this.network = network === 'mainnet' 
      ? bitcoin.networks.bitcoin 
      : bitcoin.networks.testnet;
    this.apiUrl = apiUrl || 'https://blockstream.info/api';
  }
  
  async generateAddress(mnemonic: string, index: number) {
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const root = bip32.fromSeed(seed, this.network);
    const path = `m/84'/0'/0'/0/${index}`; // Native SegWit
    const child = root.derivePath(path);
    
    const { address } = bitcoin.payments.p2wpkh({
      pubkey: child.publicKey,
      network: this.network
    });
    
    return {
      address: address!,
      publicKey: child.publicKey.toString('hex'),
      derivationPath: path
    };
  }
  
  async getBalance(address: string): Promise<string> {
    const response = await axios.get(`${this.apiUrl}/address/${address}`);
    const satoshis = response.data.chain_stats.funded_txo_sum - 
                    response.data.chain_stats.spent_txo_sum;
    return (satoshis / 100000000).toString(); // Convert to BTC
  }
  
  async transfer(params: {
    fromMnemonic: string;
    fromIndex: number;
    toAddress: string;
    amount: string;
  }): Promise<string> {
    const seed = await bip39.mnemonicToSeed(params.fromMnemonic);
    const root = bip32.fromSeed(seed, this.network);
    const path = `m/84'/0'/0'/0/${params.fromIndex}`;
    const child = root.derivePath(path);
    
    const { address: fromAddress } = bitcoin.payments.p2wpkh({
      pubkey: child.publicKey,
      network: this.network
    });
    
    // Get UTXOs
    const utxos = await axios.get(`${this.apiUrl}/address/${fromAddress}/utxo`);
    
    const psbt = new bitcoin.Psbt({ network: this.network });
    let totalInput = 0;
    
    for (const utxo of utxos.data) {
      const txHex = await axios.get(`${this.apiUrl}/tx/${utxo.txid}/hex`);
      console.log(`transaction hash ${txHex}`);
      
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: bitcoin.payments.p2wpkh({ 
            pubkey: child.publicKey,
            network: this.network 
          }).output!,
          value: utxo.value
        }
      });
      totalInput += utxo.value;
    }
    
    const amountSats = Math.floor(parseFloat(params.amount) * 100000000);
    const fee = 1000; // Simple fee estimation
    const change = totalInput - amountSats - fee;
    
    psbt.addOutput({
      address: params.toAddress,
      value: amountSats
    });
    
    if (change > 546) { // Dust limit
      psbt.addOutput({
        address: fromAddress!,
        value: change
      });
    }
    
    psbt.signAllInputs(child);
    psbt.finalizeAllInputs();
    
    const tx = psbt.extractTransaction();
    const txHex = tx.toHex();
    
    const result = await axios.post(`${this.apiUrl}/tx`, txHex);
    return result.data;
  }
  
  validateAddress(address: string): boolean {
    try {
      bitcoin.address.toOutputScript(address, this.network);
      return true;
    } catch {
      return false;
    }
  }
  
  async getTransactionStatus(txHash: string): Promise<'pending' | 'confirmed' | 'failed'> {
    try {
      const response = await axios.get(`${this.apiUrl}/tx/${txHash}/status`);
      if (response.data.confirmed) return 'confirmed';
      return 'pending';
    } catch {
      return 'failed';
    }
  }
}
