import { Router } from 'express';
import authRoutes from './auth.route';
import sweetRouter from './sweet.route';
import purchaseRouter from './purchase.route';

const router = Router();

router.use('/auth', authRoutes);
router.use('/sweet', sweetRouter);
router.use('/purchase', purchaseRouter);



export default router;
