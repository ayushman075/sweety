import { Router } from 'express';
import authRoutes from './auth.route';
import sweetRouter from './sweet.route';
import purchaseRouter from './purchase.route';
import stockMovementRouter from './stockMovement.route';

const router = Router();

router.use('/auth', authRoutes);
router.use('/sweet', sweetRouter);
router.use('/purchases', purchaseRouter);
router.use('/inventory', stockMovementRouter);



export default router;
