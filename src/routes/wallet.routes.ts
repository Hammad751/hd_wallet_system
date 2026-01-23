import { Router } from 'express';
import { WalletController } from '../controllers/WalletController';

const router = Router();
const controller = new WalletController();

router.post('/wallet', controller.createWallet);
router.get('/wallet/:userId', controller.getWallet);
router.post('/wallet/:userId/address', controller.generateNewAddress);

export default router;
