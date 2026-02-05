import { Router } from 'express';
import { WalletController } from '../controllers/WalletController';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const controller = new WalletController();

router.post('/wallet', controller.createWallet);
router.get('/wallet/:userId', controller.getWallet);
router.post('/wallet/:userId/address', controller.generateNewAddress);
router.get('/wallet/balance/:address/', authenticate, controller.getBalance);

export default router;


