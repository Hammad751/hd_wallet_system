import { Request, Response } from 'express';
import { WalletService } from '../services/WalletService';
import { ChainType } from '../types';
import { ChainAdapterFactory } from '../chains';
import { AuthRequest } from '../middleware/auth.middleware';
import { ValidationError, AuthorizationError, NotFoundError } from '../middleware/error.middleware';
import { query } from '../config/database';

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

  async getBalance(req: AuthRequest, res: Response) {
    try {
      const { address } = req.params;
      const { chain, token } = req.query;

      if (!chain) {
        throw new ValidationError('invalid params');
      }

      // Verify user owns this address
      const addressCheck = await query(
        `SELECT a.*, w.user_id 
       FROM addresses a
       JOIN wallets w ON a.wallet_id = w.id
       WHERE a.address = $1`,
        [address]
      );

      if (addressCheck.rows.length === 0) {
        throw new NotFoundError('Address not found');
      }

      
      const dbOwnerId = String(addressCheck.rows[0].user_id).toLowerCase().trim();
      const tokenUserId = String(req.user?.id).toLowerCase().trim();

      // console.log("-----------------------------------------");
      // console.log("WALLET OWNER IN DB:", dbOwnerId);
      // console.log("LOGGED-IN USER ID:", tokenUserId);
      // console.log("-----------------------------------------");

      if (dbOwnerId !== tokenUserId) {
        throw new AuthorizationError(`Not your address! DB Owner is ${dbOwnerId}`);
      }

      // if (addressCheck.rows[0].user_id !== req.user?.id && req.user?.role !== 'admin') {
      //   throw new AuthorizationError('Not your address');
      // }
      const network = addressCheck.rows[0].network;

      const adapter = ChainAdapterFactory.getAdapter(chain as ChainType, network);
      const balance = await adapter.getBalance(address, token as string);

      console.log("adapter & balacne: ", adapter, balance);
      
      return res.json({
        success: true,
        data: {
          address,
          chain,
          token: token || 'native',
          balance
        }
      });
    } catch (error: any) {
      throw error;
    }
  }


  // query = async (arg0: string, arg1: string[]) => {
  //   throw new Error('Function not implemented.');
  // }

}
