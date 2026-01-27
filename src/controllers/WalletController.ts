import { Request, Response } from 'express';
import { WalletService } from '../services/WalletService';
import { ChainType } from '../types';

export class WalletController {
  private walletService: WalletService;

  constructor() {
    this.walletService = new WalletService();
  }

  createWallet = async (req: Request, res: Response) => {
    try {
      const { userId, chains } = req.body;
      console.log("chian", userId, chains);

      if (!userId || !chains || !Array.isArray(chains)) {
        return res.status(400).json({
          error: 'userId and chains array required'
        });
      }
      console.log("chian =2 ", userId, chains);

      const wallet = await this.walletService.createWallet({
        userId,
        chains: chains.map((chain: ChainType | { chain: ChainType; network?: string }) =>
          typeof chain === 'string' ? { chain } : chain
        ),
      });
      console.log("chians created ", wallet);
      if (wallet) {

        return res.status(201).json({
          success: true,
          data: {
            userId: wallet.userId,
            addresses: wallet.addresses
          }
        });
      }
      else {
        return res.status(400).json({
          success: false,
          message: `Wallet already exists for one of the ${chains[0].chain} chains`
        });
      }


    } catch (error: any) {
      return res.status(500).json({
        error: error.message
      });
    }
  }

  getWallet = async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const wallet = await this.walletService.getWalletByUserId(userId);

      if (!wallet) {
        return res.status(404).json({
          error: 'Wallet not found'
        });
      }

      return res.json({
        success: true,
        data: {
          id: wallet.id,
          userId: wallet.user_id,
          addresses: wallet.addresses,
          createdAt: wallet.created_at
        }
      });
    } catch (error: any) {
      return res.status(500).json({
        error: error.message
      });
    }
  }

  generateNewAddress = async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { chain, network } = req.body;

      if (!chain) {
        return res.status(400).json({
          error: 'chain is required'
        });
      }

      const address = await this.walletService.generateNewAddress(
        userId,
        chain as ChainType,
        network
      );

      return res.status(201).json({
        success: true,
        data: address
      });
    } catch (error: any) {
      return res.status(500).json({
        error: error.message
      });
    }
  }
}