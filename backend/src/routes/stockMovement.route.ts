import { Router } from 'express';
import { 
  restockSweet,
  getStockMovements,
  getInventoryStatus,
  getLowStockItems,
  getSweetInventory,
  updateInventory
} from '../controllers/stockMovement.controller';
import { authenticateToken, requireAdmin } from '../middlewares/auth.middleware';

const stockMovementRouter = Router();

// All inventory routes require admin access
stockMovementRouter.use(authenticateToken, requireAdmin);

// Inventory overview routes
stockMovementRouter.get('/', getInventoryStatus);
stockMovementRouter.get('/low-stock', getLowStockItems);
stockMovementRouter.get('/movements',  getStockMovements);

stockMovementRouter.get('/:id',  getSweetInventory);
stockMovementRouter.put('/:id', updateInventory);
stockMovementRouter.post('/:id/restock', restockSweet);

export default stockMovementRouter;
