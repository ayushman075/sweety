import { Request, Response } from 'express';
import { prisma } from '../config/db.config';
import { StockMovementType } from '@prisma/client';
import AsyncHandler from '../utils/AsyncHandler';
import ApiResponse from '../utils/ApiResponse';
import { getCacheKey, getCache, setCache, deleteCachePattern } from '../utils/redis.util';

interface RestockRequest {
  quantity: number;
  reason?: string;
}

interface GetMovementsQuery {
  page?: string;
  limit?: string;
  sweetId?: string;
  type?: StockMovementType;
  sort?: string;
  order?: "asc" | "desc";
  startDate?: string;
  endDate?: string;
}

interface UpdateInventoryRequest {
  quantity?: number;
  minStockLevel?: number;
  maxStockLevel?: number;
  reorderPoint?: number;
}

// Restock sweet
const restockSweet = AsyncHandler(async (req: Request, res: Response) => {
  try {
    const { id: sweetId } = req.params;
    const { quantity, reason }: RestockRequest = req.body;

    if (!sweetId) {
      return res.status(400).json(
        new ApiResponse(400, {}, "Sweet ID is required", false)
      );
    }

    if (!quantity || quantity < 1) {
      return res.status(400).json(
        new ApiResponse(400, {}, "Valid quantity is required", false)
      );
    }

    if (quantity > 10000) {
      return res.status(400).json(
        new ApiResponse(400, {}, "Maximum restock quantity is 10,000", false)
      );
    }

    const result = await prisma.$transaction(async (tx: { sweet: { findUnique: (arg0: { where: { id: string; isActive: boolean; }; include: { inventory: boolean; }; }) => any; }; inventory: { update: (arg0: { where: { id: any; }; data: { quantity: { increment: number; }; lastRestockedAt: Date; }; }) => any; }; stockMovement: { create: (arg0: { data: { type: any; quantity: number; reason: string; reference: string; inventoryId: any; }; }) => any; }; }) => {
      // Get sweet with inventory
      const sweet = await tx.sweet.findUnique({
        where: { id: sweetId, isActive: true },
        include: { inventory: true }
      });

      if (!sweet) {
        throw new Error("Sweet not found or inactive");
      }

      if (!sweet.inventory) {
        throw new Error("Sweet inventory not found");
      }

      // Update inventory
      const updatedInventory = await tx.inventory.update({
        where: { id: sweet.inventory.id },
        data: {
          quantity: {
            increment: quantity
          },
          lastRestockedAt: new Date()
        }
      });

      // Create stock movement record
      const stockMovement = await tx.stockMovement.create({
        data: {
          type: StockMovementType.RESTOCK,
          quantity,
          reason: reason || `Restock of ${quantity} units`,
          reference: `RESTOCK-${Date.now()}`,
          inventoryId: sweet.inventory.id
        }
      });

      return {
        sweet: {
          id: sweet.id,
          name: sweet.name,
          category: sweet.category
        },
        inventory: updatedInventory,
        stockMovement,
        previousQuantity: sweet.inventory.quantity,
        newQuantity: updatedInventory.quantity
      };
    });

    // Clear relevant caches
    await deleteCachePattern(`inventory:*`);
    await deleteCachePattern(`sweet:${sweetId}*`);
    await deleteCachePattern(`stock_movements:*`);

    return res.status(200).json(
      new ApiResponse(200, result, "Sweet restocked successfully", true)
    );

  } catch (error: any) {
    console.error("Restock sweet error:", error);

    if (error.message.includes("not found")) {
      return res.status(404).json(
        new ApiResponse(404, {}, error.message, false)
      );
    }

    return res.status(500).json(
      new ApiResponse(500, {}, "Internal Server Error", false)
    );
  }
});

// Get stock movements
const getStockMovements = AsyncHandler(async (req: Request, res: Response) => {
  try {
    const {
      page = "1",
      limit = "10",
      sweetId,
      type,
      sort = "createdAt",
      order = "desc",
      startDate,
      endDate
    }: GetMovementsQuery = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const cacheKey = getCacheKey(
      "stock_movements",
      `${page}-${limit}-${sweetId || 'all'}-${type || 'all'}-${sort}-${order}-${startDate || 'none'}-${endDate || 'none'}`
    );

    let cachedResult = await getCache<any>(cacheKey);

    if (!cachedResult) {
      const where: any = {};

      if (sweetId) {
        where.inventory = {
          sweetId
        };
      }

      if (type) {
        where.type = type;
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const [movements, totalMovements] = await Promise.all([
        prisma.stockMovement.findMany({
          where,
          orderBy: { [sort]: order },
          skip,
          take: limitNum,
          include: {
            inventory: {
              include: {
                sweet: {
                  select: {
                    id: true,
                    name: true,
                    category: true,
                    imageUrl: true
                  }
                }
              }
            }
          }
        }),
        prisma.stockMovement.count({ where })
      ]);

      // Calculate movement summary
      const movementSummary = await prisma.stockMovement.groupBy({
        by: ['type'],
        where,
        _sum: { quantity: true },
        _count: true
      });

      cachedResult = {
        movements,
        totalMovements,
        totalPages: Math.ceil(totalMovements / limitNum),
        currentPage: pageNum,
        movementSummary,
        hasNextPage: pageNum < Math.ceil(totalMovements / limitNum),
        hasPreviousPage: pageNum > 1
      };

      await setCache(cacheKey, cachedResult, 300); // 5 minutes
    }

    return res.status(200).json(
      new ApiResponse(200, cachedResult, "Stock movements retrieved successfully", true)
    );

  } catch (error) {
    console.error("Get stock movements error:", error);
    return res.status(500).json(
      new ApiResponse(500, {}, "Internal server error", false)
    );
  }
});

// Get inventory status
const getInventoryStatus = AsyncHandler(async (req: Request, res: Response) => {
  try {
    const cacheKey = getCacheKey("inventory_status", "all");
    let inventoryData = await getCache<any>(cacheKey);

    if (!inventoryData) {
      const inventory = await prisma.inventory.findMany({
        include: {
          sweet: {
            select: {
              id: true,
              name: true,
              category: true,
              price: true,
              imageUrl: true,
              isActive: true
            }
          },
          _count: {
            select: {
              stockMovements: true
            }
          }
        },
        where: {
          sweet: {
            isActive: true
          }
        },
        orderBy: {
          sweet: {
            name: 'asc'
          }
        }
      });

      // Calculate comprehensive stats
      const totalItems = inventory.length;
    const lowStockItems: number = inventory.filter((item: { quantity: number; reorderPoint: number; }) => item.quantity <= item.reorderPoint).length;
      const outOfStockItems = inventory.filter((item: { quantity: number; reorderPoint: number; }) => item.quantity === 0).length;
      const overstockedItems = inventory.filter((item: { quantity: number; reorderPoint: number; maxStockLevel: number; }) => item.quantity > item.maxStockLevel).length;
    const totalQuantity = inventory.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0);
      const totalValue = inventory.reduce((sum: number, item) => sum + (item.quantity * Number(item.sweet.price.toString())), 0);

      inventoryData = {
        inventory,
        stats: {
          totalItems,
          lowStockItems,
          outOfStockItems,
          overstockedItems,
          totalQuantity,
          totalValue,
          averageQuantityPerItem: totalItems > 0 ? Math.round(totalQuantity / totalItems) : 0
        }
      };

      await setCache(cacheKey, inventoryData, 300); // 5 minutes
    }

    return res.status(200).json(
      new ApiResponse(200, inventoryData, "Inventory status retrieved successfully", true)
    );

  } catch (error) {
    console.error("Get inventory status error:", error);
    return res.status(500).json(
      new ApiResponse(500, {}, "Internal server error", false)
    );
  }
});

// Get low stock items
const getLowStockItems = AsyncHandler(async (req: Request, res: Response) => {
  try {
    const cacheKey = getCacheKey("low_stock_items", "all");
    let lowStockItems = await getCache<any>(cacheKey);

    if (!lowStockItems) {
      const lowStock = await prisma.$queryRaw`
        SELECT 
          i.id,
          i.quantity,
          i.min_stock_level,
          i.reorder_point,
          i.last_restocked_at,
          s.id as sweet_id,
          s.name as sweet_name,
          s.category,
          s.price,
          s.image_url
        FROM inventory i
        JOIN sweets s ON i.sweet_id = s.id
        WHERE s.is_active = true 
          AND i.quantity <= i.reorder_point
        ORDER BY 
          CASE 
            WHEN i.quantity = 0 THEN 0
            ELSE i.quantity
          END ASC,
          i.reorder_point DESC
      `;

      lowStockItems = lowStock;
      await setCache(cacheKey, lowStockItems, 300); // 5 minutes
    }

    return res.status(200).json(
      new ApiResponse(200, lowStockItems, "Low stock items retrieved successfully", true)
    );

  } catch (error) {
    console.error("Get low stock items error:", error);
    return res.status(500).json(
      new ApiResponse(500, {}, "Internal server error", false)
    );
  }
});

// Get inventory for a specific sweet
const getSweetInventory = AsyncHandler(async (req: Request, res: Response) => {
  try {
    const { id: sweetId } = req.params;

    if (!sweetId) {
      return res.status(400).json(
        new ApiResponse(400, {}, "Sweet ID is required", false)
      );
    }

    const cacheKey = getCacheKey("sweet_inventory", sweetId);
    let inventoryData = await getCache<any>(cacheKey);

    if (!inventoryData) {
      const inventory = await prisma.inventory.findFirst({
        where: {
          sweetId,
          sweet: {
            isActive: true
          }
        },
        include: {
          sweet: {
            select: {
              id: true,
              name: true,
              category: true,
              price: true,
              imageUrl: true
            }
          },
          stockMovements: {
            orderBy: {
              createdAt: 'desc'
            },
            take: 10 // Recent movements
          }
        }
      });

      if (!inventory) {
        return res.status(404).json(
          new ApiResponse(404, {}, "Inventory not found for this sweet", false)
        );
      }

      // Calculate additional metrics
      const totalMovements = await prisma.stockMovement.count({
        where: { inventoryId: inventory.id }
      });

      const movementStats = await prisma.stockMovement.groupBy({
        by: ['type'],
        where: { inventoryId: inventory.id },
        _sum: { quantity: true },
        _count: true
      });

      inventoryData = {
        ...inventory,
        totalMovements,
        movementStats,
        stockStatus: inventory.quantity === 0 ? 'OUT_OF_STOCK' :
                    inventory.quantity <= inventory.reorderPoint ? 'LOW_STOCK' :
                    inventory.quantity > inventory.maxStockLevel ? 'OVERSTOCKED' : 'NORMAL',
        daysUntilRestock: inventory.lastRestockedAt ? 
          Math.floor((Date.now() - inventory.lastRestockedAt.getTime()) / (1000 * 60 * 60 * 24)) : null
      };

      await setCache(cacheKey, inventoryData, 600); // 10 minutes
    }

    return res.status(200).json(
      new ApiResponse(200, inventoryData, "Sweet inventory retrieved successfully", true)
    );

  } catch (error) {
    console.error("Get sweet inventory error:", error);
    return res.status(500).json(
      new ApiResponse(500, {}, "Internal server error", false)
    );
  }
});

// Update inventory settings
const updateInventory = AsyncHandler(async (req: Request, res: Response) => {
  try {
    const { id: sweetId } = req.params;
    const { quantity, minStockLevel, maxStockLevel, reorderPoint }: UpdateInventoryRequest = req.body;

    if (!sweetId) {
      return res.status(400).json(
        new ApiResponse(400, {}, "Sweet ID is required", false)
      );
    }

    const inventory = await prisma.inventory.findFirst({
      where: { sweetId, sweet: { isActive: true } }
    });

    if (!inventory) {
      return res.status(404).json(
        new ApiResponse(404, {}, "Inventory not found for this sweet", false)
      );
    }

    // Validate inventory levels
    if (minStockLevel !== undefined && maxStockLevel !== undefined && minStockLevel >= maxStockLevel) {
      return res.status(400).json(
        new ApiResponse(400, {}, "Minimum stock level must be less than maximum stock level", false)
      );
    }

    if (reorderPoint !== undefined && minStockLevel !== undefined && reorderPoint < minStockLevel) {
      return res.status(400).json(
        new ApiResponse(400, {}, "Reorder point must be greater than or equal to minimum stock level", false)
      );
    }

    const updateData: any = {};
    if (quantity !== undefined) updateData.quantity = quantity;
    if (minStockLevel !== undefined) updateData.minStockLevel = minStockLevel;
    if (maxStockLevel !== undefined) updateData.maxStockLevel = maxStockLevel;
    if (reorderPoint !== undefined) updateData.reorderPoint = reorderPoint;

    const updatedInventory = await prisma.inventory.update({
      where: { id: inventory.id },
      data: updateData,
      include: {
        sweet: {
          select: {
            id: true,
            name: true,
            category: true
          }
        }
      }
    });

    // Clear caches
    await deleteCachePattern(`inventory:*`);
    await deleteCachePattern(`sweet:${sweetId}*`);

    return res.status(200).json(
      new ApiResponse(200, updatedInventory, "Inventory updated successfully", true)
    );

  } catch (error) {
    console.error("Update inventory error:", error);
    return res.status(500).json(
      new ApiResponse(500, {}, "Internal server error", false)
    );
  }
});

export {
  restockSweet,
  getStockMovements,
  getInventoryStatus,
  getLowStockItems,
  getSweetInventory,
  updateInventory
};
