import { Router } from 'express';
import { 
  createPurchase,
  getUserPurchases,
  getPurchase,
  cancelPurchase,
  getAllPurchases,
  updatePurchaseStatus,
  getPurchaseStats
} from '../controllers/purchase.controller';
import { authenticateToken, requireAdmin } from '../middlewares/auth.middleware';

const purchaseRouter = Router();

purchaseRouter.post('/', authenticateToken,  createPurchase);
purchaseRouter.get('/my-purchases', authenticateToken,  getUserPurchases);
purchaseRouter.get('/:id', authenticateToken,  getPurchase);
purchaseRouter.put('/:id/cancel', authenticateToken,  cancelPurchase);

purchaseRouter.get('/', authenticateToken, requireAdmin,  getAllPurchases);

export default purchaseRouter;
