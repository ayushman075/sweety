import { Request, Response } from 'express';
import { prisma } from '../config/db.config';
import { PurchaseStatus, StockMovementType, PrismaClient } from '@prisma/client';
import AsyncHandler from '../utils/AsyncHandler';
import ApiResponse from '../utils/ApiResponse';
import { getCacheKey, getCache, setCache, deleteCache, deleteCachePattern } from '../utils/redis.util';

interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
    role: string;
    email: string;
  };
}

interface CreatePurchaseRequest {
  sweetId: string;
  quantity: number;
}

interface UpdatePurchaseStatusRequest {
  status: PurchaseStatus;
}

interface GetPurchasesQuery {
  page?: string;
  limit?: string;
  status?: PurchaseStatus;
  userId?: string;
  sort?: string;
  order?: "asc" | "desc";
  startDate?: string;
  endDate?: string;
}

// Generate unique order number
const generateOrderNumber = (): string => {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${timestamp.slice(-6)}-${random}`;
};

// Create new purchase
const createPurchase = AsyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.auth?.userId;
    const { sweetId, quantity }: CreatePurchaseRequest = req.body;

    if (!userId) {
      return res.status(401).json(
        new ApiResponse(401, {}, "Authentication required", false)
      );
    }

    if (!sweetId || !quantity || quantity < 1) {
      return res.status(400).json(
        new ApiResponse(400, {}, "Sweet ID and valid quantity are required", false)
      );
    }

    if (quantity > 100) {
      return res.status(400).json(
        new ApiResponse(400, {}, "Maximum quantity per purchase is 100", false)
      );
    }

    // Create purchase with inventory update in transaction
    interface Sweet {
      id: string;
      price: number;
      isActive: boolean;
      inventory: {
        id: string;
        quantity: number;
      } | null;
    }

    interface PurchaseCreate {
      orderNumber: string;
      quantity: number;
      unitPrice: number;
      totalAmount: number;
      status: PurchaseStatus;
      userId: string;
      sweetId: string;
    }

    interface PurchaseResult {
      id: string;
      orderNumber: string;
      user: {
        id: string;
        name: string;
        email: string;
      };
      sweet: {
        id: string;
        name: string;
        category: string;
        price: any;
        imageUrl: string | null;
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Check sweet exists and is active
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

      // Check stock availability
      if (sweet.inventory.quantity < quantity) {
        throw new Error(`Insufficient stock available. Only ${sweet.inventory.quantity} items in stock`);
      }

      // Create purchase
      const purchase: PurchaseResult = await tx.purchase.create({
        data: {
          orderNumber: generateOrderNumber(),
          quantity,
          unitPrice: sweet.price,
          totalAmount: sweet.price || 0 * quantity,
          status: PurchaseStatus.PENDING,
          userId,
          sweetId
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          sweet: {
            select: {
              id: true,
              name: true,
              category: true,
              price: true,
              imageUrl: true
            }
          }
        }
      });

      // Update inventory
      await tx.inventory.update({
        where: { id: sweet.inventory.id },
        data: {
          quantity: {
            decrement: quantity
          }
        }
      });

      // Create stock movement record
      await tx.stockMovement.create({
        data: {
          type: StockMovementType.RESTOCK,
          quantity: -quantity,
          reason: `Purchase - Order ${purchase.orderNumber}`,
          reference: purchase.id,
          inventoryId: sweet.inventory.id
        }
      });

      return purchase;
    });

    // Clear relevant caches
    await deleteCachePattern(`purchases:user:${userId}:*`);
    await deleteCachePattern(`purchases:*`);
    await deleteCache(getCacheKey("sweet", sweetId));
    await deleteCachePattern(`inventory:*`);

    return res.status(201).json(
      new ApiResponse(201, result, "Purchase created successfully", true)
    );

  } catch (error: any) {
    console.error("Create purchase error:", error);

    if (error.message.includes("not found")) {
      return res.status(404).json(
        new ApiResponse(404, {}, error.message, false)
      );
    }

    if (error.message.includes("Insufficient stock") || error.message.includes("inventory not found")) {
      return res.status(400).json(
        new ApiResponse(400, {}, error.message, false)
      );
    }

    return res.status(500).json(
      new ApiResponse(500, {}, "Internal Server Error", false)
    );
  }
});

// Get user's purchases
const getUserPurchases = AsyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.auth?.userId;
    const { 
      page = "1", 
      limit = "10", 
      status,
      sort = "createdAt",
      order = "desc",
      startDate,
      endDate
    }: GetPurchasesQuery = req.query;

    if (!userId) {
      return res.status(401).json(
        new ApiResponse(401, {}, "Authentication required", false)
      );
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const cacheKey = getCacheKey(
      "purchases",
      `user:${userId}:${page}-${limit}-${status || 'all'}-${sort}-${order}-${startDate || 'none'}-${endDate || 'none'}`
    );

    let cachedResult = await getCache<any>(cacheKey);

    if (!cachedResult) {
      const where: any = { userId };

      if (status) {
        where.status = status;
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const [purchases, totalPurchases] = await Promise.all([
        prisma.purchase.findMany({
          where,
          orderBy: { [sort]: order },
          skip,
          take: limitNum,
          include: {
            sweet: {
              select: {
                id: true,
                name: true,
                category: true,
                imageUrl: true,
                price: true
              }
            }
          }
        }),
        prisma.purchase.count({ where })
      ]);

      // Calculate summary stats
      const totalAmount = await prisma.purchase.aggregate({
        where: { ...where, status: { not: PurchaseStatus.CANCELLED } },
        _sum: { totalAmount: true }
      });

      cachedResult = {
        purchases,
        totalPurchases,
        totalPages: Math.ceil(totalPurchases / limitNum),
        currentPage: pageNum,
        totalSpent: totalAmount._sum.totalAmount || 0,
        hasNextPage: pageNum < Math.ceil(totalPurchases / limitNum),
        hasPreviousPage: pageNum > 1
      };

      await setCache(cacheKey, cachedResult, 300); // 5 minutes
    }

    return res.status(200).json(
      new ApiResponse(200, cachedResult, "User purchases retrieved successfully", true)
    );

  } catch (error) {
    console.error("Get user purchases error:", error);
    return res.status(500).json(
      new ApiResponse(500, {}, "Internal server error", false)
    );
  }
});

// Get single purchase
const getPurchase = AsyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.auth?.userId;
    const userRole = req.auth?.role;

    if (!userId) {
      return res.status(401).json(
        new ApiResponse(401, {}, "Authentication required", false)
      );
    }

    if (!id) {
      return res.status(400).json(
        new ApiResponse(400, {}, "Purchase ID is required", false)
      );
    }

    const cacheKey = getCacheKey("purchase", `${id}-${userId}`);
    let purchase = await getCache<any>(cacheKey);

    if (!purchase) {
      const whereClause: any = { id };
      
      // Regular users can only see their own purchases
      if (userRole !== 'ADMIN') {
        whereClause.userId = userId;
      }

      purchase = await prisma.purchase.findUnique({
        where: whereClause,
        include: {
          sweet: {
            select: {
              id: true,
              name: true,
              category: true,
              imageUrl: true,
              price: true
            }
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      if (!purchase) {
        return res.status(404).json(
          new ApiResponse(404, {}, "Purchase not found", false)
        );
      }

      await setCache(cacheKey, purchase, 1800); // 30 minutes
    }

    return res.status(200).json(
      new ApiResponse(200, purchase, "Purchase retrieved successfully", true)
    );

  } catch (error) {
    console.error("Get purchase error:", error);
    return res.status(500).json(
      new ApiResponse(500, {}, "Internal server error", false)
    );
  }
});

// Cancel purchase
const cancelPurchase = AsyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json(
        new ApiResponse(401, {}, "Authentication required", false)
      );
    }

    if (!id) {
      return res.status(400).json(
        new ApiResponse(400, {}, "Purchase ID is required", false)
      );
    }

    interface PurchaseWithSweetInventory {
        id: string;
        status: PurchaseStatus;
        quantity: number;
        orderNumber: string;
        sweet: {
            inventory: {
                id: string;
            } | null;
        };
    }

    interface StockMovementCreate {
        type: StockMovementType;
        quantity: number;
        reason: string;
        reference: string;
        inventoryId: string;
    }

            await prisma.$transaction(async (tx: any) => {
                // Get purchase with sweet inventory
                const purchase: PurchaseWithSweetInventory = await tx.purchase.findUnique({
                    where: { id, userId },
                    include: {
                        sweet: {
                            include: {
                                inventory: true
                            }
                        }
                    }
                });

                if (!purchase) {
                    throw new Error("Purchase not found");
                }

                if (purchase.status !== PurchaseStatus.PENDING) {
                    throw new Error(`Purchase with status ${purchase.status} cannot be cancelled`);
                }

                // Update purchase status
                await tx.purchase.update({
                    where: { id },
                    data: { 
                        status: PurchaseStatus.CANCELLED,
                        updatedAt: new Date()
                    }
                });

                // Restore inventory
                if (purchase.sweet.inventory) {
                    await tx.inventory.update({
                        where: { id: purchase.sweet.inventory.id },
                        data: {
                            quantity: {
                                increment: purchase.quantity
                            }
                        }
                    });

                    // Create return stock movement
                    const stockMovement: StockMovementCreate = {
                        type: StockMovementType.RETURN,
                        quantity: purchase.quantity, // Positive for stock return
                        reason: `Purchase cancelled - Order ${purchase.orderNumber}`,
                        reference: purchase.id,
                        inventoryId: purchase.sweet.inventory.id
                    };
                    await tx.stockMovement.create({ data: stockMovement });
                }
            });

    // Clear caches
    await deleteCache(getCacheKey("purchase", `${id}-${userId}`));
    await deleteCachePattern(`purchases:user:${userId}:*`);
    await deleteCachePattern(`purchases:*`);
    await deleteCachePattern(`inventory:*`);

    return res.status(200).json(
      new ApiResponse(200, {}, "Purchase cancelled successfully", true)
    );

  } catch (error: any) {
    console.error("Cancel purchase error:", error);

    if (error.message.includes("not found")) {
      return res.status(404).json(
        new ApiResponse(404, {}, error.message, false)
      );
    }

    if (error.message.includes("cannot be cancelled")) {
      return res.status(400).json(
        new ApiResponse(400, {}, error.message, false)
      );
    }

    return res.status(500).json(
      new ApiResponse(500, {}, "Internal server error", false)
    );
  }
});

// Get all purchases (Admin only)
const getAllPurchases = AsyncHandler(async (req: Request, res: Response) => {
  try {
    const { 
      page = "1", 
      limit = "10",
      status,
      userId,
      sort = "createdAt",
      order = "desc",
      startDate,
      endDate
    }: GetPurchasesQuery = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const cacheKey = getCacheKey(
      "purchases",
      `admin:${page}-${limit}-${status || 'all'}-${userId || 'all'}-${sort}-${order}-${startDate || 'none'}-${endDate || 'none'}`
    );

    let cachedResult = await getCache<any>(cacheKey);

    if (!cachedResult) {
      const where: any = {};

      if (status) where.status = status;
      if (userId) where.userId = userId;
      
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const [purchases, totalPurchases] = await Promise.all([
        prisma.purchase.findMany({
          where,
          orderBy: { [sort]: order },
          skip,
          take: limitNum,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            sweet: {
              select: {
                id: true,
                name: true,
                category: true,
                imageUrl: true
              }
            }
          }
        }),
        prisma.purchase.count({ where })
      ]);

      // Calculate revenue stats
      const revenueStats = await prisma.purchase.aggregate({
        where: { ...where, status: { not: PurchaseStatus.CANCELLED } },
        _sum: { totalAmount: true },
        _avg: { totalAmount: true }
      });

      cachedResult = {
        purchases,
        totalPurchases,
        totalPages: Math.ceil(totalPurchases / limitNum),
        currentPage: pageNum,
        totalRevenue: revenueStats._sum.totalAmount || 0,
        averageOrderValue: revenueStats._avg.totalAmount || 0,
        hasNextPage: pageNum < Math.ceil(totalPurchases / limitNum),
        hasPreviousPage: pageNum > 1
      };

      await setCache(cacheKey, cachedResult, 300); // 5 minutes
    }

    return res.status(200).json(
      new ApiResponse(200, cachedResult, "All purchases retrieved successfully", true)
    );

  } catch (error) {
    console.error("Get all purchases error:", error);
    return res.status(500).json(
      new ApiResponse(500, {}, "Internal server error", false)
    );
  }
});

// Update purchase status (Admin only)
const updatePurchaseStatus = AsyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status }: UpdatePurchaseStatusRequest = req.body;

    if (!id || !status) {
      return res.status(400).json(
        new ApiResponse(400, {}, "Purchase ID and status are required", false)
      );
    }

    if (!Object.values(PurchaseStatus).includes(status)) {
      return res.status(400).json(
        new ApiResponse(400, {}, "Invalid purchase status", false)
      );
    }

    const purchase = await prisma.purchase.findUnique({
      where: { id }
    });

    if (!purchase) {
      return res.status(404).json(
        new ApiResponse(404, {}, "Purchase not found", false)
      );
    }

    // Prevent certain status transitions
    if (purchase.status === PurchaseStatus.CANCELLED || purchase.status === PurchaseStatus.RETURNED) {
      return res.status(400).json(
        new ApiResponse(400, {}, `Cannot change status from ${purchase.status}`, false)
      );
    }

    const updatedPurchase = await prisma.purchase.update({
      where: { id },
      data: { status },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
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
    await deleteCache(getCacheKey("purchase", `${id}-${purchase.userId}`));
    await deleteCachePattern(`purchases:*`);

    return res.status(200).json(
      new ApiResponse(200, updatedPurchase, "Purchase status updated successfully", true)
    );

  } catch (error) {
    console.error("Update purchase status error:", error);
    return res.status(500).json(
      new ApiResponse(500, {}, "Internal server error", false)
    );
  }
});

// Get purchase statistics (Admin only)
const getPurchaseStats = AsyncHandler(async (req: Request, res: Response) => {
  try {
    const { days = "30" } = req.query;
    const daysNum = parseInt(days as string, 10);

    const cacheKey = getCacheKey("purchase_stats", `days_${daysNum}`);
    let stats = await getCache<any>(cacheKey);

    if (!stats) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNum);

      const [
        totalStats,
        statusStats,
        dailyStats,
        topSweets
      ] = await Promise.all([
        // Total statistics
        prisma.purchase.aggregate({
          where: {
            createdAt: { gte: startDate },
            status: { not: PurchaseStatus.CANCELLED }
          },
          _count: true,
          _sum: { totalAmount: true, quantity: true },
          _avg: { totalAmount: true }
        }),

        // Status breakdown
        prisma.purchase.groupBy({
          by: ['status'],
          where: { createdAt: { gte: startDate } },
          _count: true,
          _sum: { totalAmount: true }
        }),

        // Daily statistics
        prisma.$queryRaw`
          SELECT 
            DATE(created_at) as date,
            COUNT(*)::int as orders,
            SUM(total_amount)::float as revenue,
            SUM(quantity)::int as items_sold
          FROM purchases 
          WHERE created_at >= ${startDate}
            AND status != ${PurchaseStatus.CANCELLED}
          GROUP BY DATE(created_at)
          ORDER BY date DESC
          LIMIT 30
        `,

        // Top selling sweets
        prisma.purchase.groupBy({
          by: ['sweetId'],
          where: {
            createdAt: { gte: startDate },
            status: { not: PurchaseStatus.CANCELLED }
          },
          _count: true,
          _sum: { quantity: true, totalAmount: true },
          orderBy: { _sum: { quantity: 'desc' } },
          take: 10
        })
      ]);

      // Get sweet details for top sweets
      const sweetIds = topSweets.map((item: { sweetId: any; }) => item.sweetId);
      const sweetDetails = await prisma.sweet.findMany({
        where: { id: { in: sweetIds } },
        select: { id: true, name: true, category: true, imageUrl: true }
      });

      const topSweetsWithDetails = topSweets.map((item: { sweetId: any; }) => ({
        ...item,
        sweet: sweetDetails.find((sweet: { id: any; }) => sweet.id === item.sweetId)
      }));

      stats = {
        summary: {
          totalOrders: totalStats._count,
          totalRevenue: totalStats._sum.totalAmount || 0,
          totalItemsSold: totalStats._sum.quantity || 0,
          averageOrderValue: totalStats._avg.totalAmount || 0
        },
        statusBreakdown: statusStats,
        dailyStats,
        topSweets: topSweetsWithDetails,
        period: `Last ${daysNum} days`
      };

      await setCache(cacheKey, stats, 600); // 10 minutes
    }

    return res.status(200).json(
      new ApiResponse(200, stats, "Purchase statistics retrieved successfully", true)
    );

  } catch (error) {
    console.error("Get purchase stats error:", error);
    return res.status(500).json(
      new ApiResponse(500, {}, "Internal server error", false)
    );
  }
});

export {
  createPurchase,
  getUserPurchases,
  getPurchase,
  cancelPurchase,
  getAllPurchases,
  updatePurchaseStatus,
  getPurchaseStats
};
