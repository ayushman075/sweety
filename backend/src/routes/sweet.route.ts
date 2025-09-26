import { Router } from 'express';
import { 
  createSweet,
  getAllSweets,
  getSweet,
  updateSweet,
  deleteSweet,
  getSweetsByCategory,
  searchSweets
} from '../controllers/sweet.controller';
import { authenticateToken, requireAdmin } from '../middlewares/auth.middleware';

const sweetRouter = Router();

sweetRouter.get('/',  getAllSweets);
sweetRouter.get('/search', searchSweets);
sweetRouter.get('/category/:category', getSweetsByCategory);
sweetRouter.get('/:id', getSweet);

sweetRouter.post('/', 
  authenticateToken, 
  requireAdmin, 
  createSweet
);

sweetRouter.put('/:id', 
  authenticateToken, 
  requireAdmin, 
  updateSweet
);

sweetRouter.delete('/:id', authenticateToken, requireAdmin,  deleteSweet);

export default sweetRouter;
