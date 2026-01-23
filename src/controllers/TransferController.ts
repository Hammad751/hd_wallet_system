import { Request, Response } from 'express';
import { TransferService } from '../services/TransferService';
import { FlushService } from '../services/FlushService';
import { ChainType } from '../types';

export class TransferController {
  private transferService: TransferService;
  private flushService: FlushService;
  
  constructor() {
    this.transferService = new TransferService();
    this.flushService = new FlushService();
  }
  
  transfer = async (req: Request, res: Response) => {
    try {
      const { fromAddress, toAddress, amount, chain, token } = req.body;
      
      if (!fromAddress || !toAddress || !amount || !chain) {
        return res.status(400).json({ 
          error: 'fromAddress, toAddress, amount, and chain are required' 
        });
      }
      
      const txHash = await this.transferService.transfer({
        fromAddress,
        toAddress,
        amount,
        chain: chain as ChainType,
        token
      });
      
      res.json({
        success: true,
        data: { txHash }
      });
    } catch (error: any) {
      res.status(500).json({ 
        error: error.message 
      });
    }
  }
  
  getTransactionStatus = async (req: Request, res: Response) => {
    try {
      const { txHash } = req.params;
      const { chain } = req.query;
      
      const transaction = await this.transferService.getTransactionStatus(
        txHash,
        chain as string
      );
      
      res.json({
        success: true,
        data: transaction
      });
    } catch (error: any) {
      res.status(500).json({ 
        error: error.message 
      });
    }
  }
  
  flushToHotWallet = async (req: Request, res: Response) => {
    try {
      const { userAddresses, hotWalletAddress, chain, token } = req.body;
      
      if (!userAddresses || !hotWalletAddress || !chain) {
        return res.status(400).json({ 
          error: 'userAddresses, hotWalletAddress, and chain are required' 
        });
      }
      
      const txHashes = await this.flushService.flushToHotWallet({
        userAddresses,
        hotWalletAddress,
        chain: chain as ChainType,
        token
      });
      
      res.json({
        success: true,
        data: { txHashes, count: txHashes.length }
      });
    } catch (error: any) {
      res.status(500).json({ 
        error: error.message 
      });
    }
  }
}
