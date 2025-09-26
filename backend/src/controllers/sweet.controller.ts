import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { prisma } from '../config/db.config';
import { SweetCategory } from '@prisma/client';
import AsyncHandler from '../utils/AsyncHandler';
import ApiResponse from '../utils/ApiResponse';
import { getCacheKey, getCache, setCache, deleteCache, deleteCachePattern } from '../utils/redis.util';
import { uploadFileOnCloudinary} from '../utils/cloudinary';
import { uploadSweetImage, cleanupUploadedFiles } from '../middlewares/upload.middleware';

interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
    role: string;
    email: string;
  };
}

interface CreateSweetRequest {
  name: string;
  description?: string;
  category: SweetCategory;
  price: number;
  quantity: number;
}

interface UpdateSweetRequest {
  name?: string;
  description?: string;
  category?: SweetCategory;
  price?: number;
}

interface GetAllSweetsQuery {
  page?: string;
  limit?: string;
  sort?: string;
  order?: "asc" | "desc";
  category?: SweetCategory;
  search?: string;
}

// Helper function to handle multer errors
const handleMulterError = (error: any, res: Response): boolean => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json(
        new ApiResponse(400, {}, "File too large. Maximum size is 5MB", false)
      );
      return true;
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json(
        new ApiResponse(400, {}, "Too many files. Only one image allowed", false)
      );
      return true;
    }
    
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      res.status(400).json(
        new ApiResponse(400, {}, "Unexpected field name. Use 'image' as field name", false)
      );
      return true;
    }
    
    res.status(400).json(
      new ApiResponse(400, {}, `Upload error: ${error.message}`, false)
    );
    return true;
  }
  
  if (error.message && error.message.includes('Invalid file')) {
    res.status(400).json(
      new ApiResponse(400, {}, error.message, false)
    );
    return true;
  }
  
  return false;
};

// Create new sweet with image upload
const createSweet = AsyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Handle file upload with error handling
  uploadSweetImage(req, res, async (uploadError: any) => {
    try {
      // Handle multer errors
      if (uploadError) {
        const handled = handleMulterError(uploadError, res);
        if (handled) return;
        
        return res.status(500).json(
          new ApiResponse(500, {}, "File upload failed", false)
        );
      }

      const { name, description, category, price, quantity }: CreateSweetRequest = req.body;
      const imageFile = req.file;

      if (!name || !category || !price || quantity === undefined) {
        if (imageFile) {
          cleanupUploadedFiles([imageFile]);
        }
        
        return res.status(400).json(
          new ApiResponse(400, {}, "Name, category, price, and quantity are required", false)
        );
      }

      // Check if sweet name already exists
      const existingSweet = await prisma.sweet.findFirst({
        where: { 
          name: { equals: name, mode: 'insensitive' },
          isActive: true 
        }
      });

      if (existingSweet) {
        if (imageFile) {
          cleanupUploadedFiles([imageFile]);
        }
        
        return res.status(409).json(
          new ApiResponse(409, {}, "Sweet with this name already exists", false)
        );
      }

      let imageUrl: string | undefined;

      // Upload image to Cloudinary if provided
      if (imageFile) {
        imageUrl = await uploadFileOnCloudinary(imageFile.path) || "N/A";
        
        if (!imageUrl) {
          return res.status(500).json(
            new ApiResponse(500, {}, "Failed to upload image. Please try again.", false)
          );
        }
      }

      // Create sweet with inventory in a transaction
      const sweet = await prisma.$transaction(async (tx: { sweet: { create: (arg0: { data: { name: string; description: string | undefined; category: any; price: number; imageUrl: string | undefined; inventory: { create: { quantity: number; minStockLevel: number; maxStockLevel: number; reorderPoint: number; }; }; }; include: { inventory: boolean; _count: { select: { purchases: boolean; }; }; }; }) => any; }; }) => {
        const newSweet = await tx.sweet.create({
          data: {
            name: name.trim(),
            description: description?.trim(),
            category,
            price,
            imageUrl,
            inventory: {
              create: {
                quantity:Number(quantity),
                minStockLevel: 5,
                maxStockLevel: quantity * 10,
                reorderPoint: Math.max(10, Math.floor(quantity * 0.2))
              }
            }
          },
          include: {
            inventory: true,
            _count: {
              select: { purchases: true }
            }
          }
        });

        return newSweet;
      });

      // Cache the new sweet
      const cacheKey = getCacheKey("sweet", sweet.id);
      await setCache(cacheKey, sweet, 3600);
      await deleteCachePattern(`sweets:*`);

      return res.status(201).json(
        new ApiResponse(201, sweet, "Sweet created successfully", true)
      );

    } catch (error: any) {
      console.error("Create sweet error:", error);
      
      // Clean up uploaded file if error occurs
      if (req.file) {
        cleanupUploadedFiles([req.file]);
      }
      
      if (error.code === 'P2002') {
        return res.status(409).json(
          new ApiResponse(409, {}, "Sweet with this name already exists", false)
        );
      }

      return res.status(500).json(
        new ApiResponse(500, {}, "Internal Server Error", false)
      );
    }
  });
});

// Update sweet with image upload
const updateSweet = AsyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // Handle file upload with error handling
  uploadSweetImage(req, res, async (uploadError: any) => {
    try {
      // Handle multer errors
      if (uploadError) {
        const handled = handleMulterError(uploadError, res);
        if (handled) return;
        
        return res.status(500).json(
          new ApiResponse(500, {}, "File upload failed", false)
        );
      }

      const { id } = req.params;
      const { name, description, category, price }: UpdateSweetRequest = req.body;
      const imageFile = req.file;

      if (!id) {
        if (imageFile) {
          cleanupUploadedFiles([imageFile]);
        }
        
        return res.status(400).json(
          new ApiResponse(400, {}, "Sweet ID is required", false)
        );
      }

      const existingSweet = await prisma.sweet.findUnique({
        where: { id, isActive: true }
      });

      if (!existingSweet) {
        if (imageFile) {
          cleanupUploadedFiles([imageFile]);
        }
        
        return res.status(404).json(
          new ApiResponse(404, {}, "Sweet not found", false)
        );
      }

      // Check for duplicate name if updating name
      if (name && name !== existingSweet.name) {
        const duplicateSweet = await prisma.sweet.findFirst({
          where: {
            name: { equals: name, mode: 'insensitive' },
            isActive: true,
            NOT: { id }
          }
        });

        if (duplicateSweet) {
          if (imageFile) {
            cleanupUploadedFiles([imageFile]);
          }
          
          return res.status(409).json(
            new ApiResponse(409, {}, "Sweet with this name already exists", false)
          );
        }
      }

      let newImageUrl: string | undefined;
      let oldImageUrl = existingSweet.imageUrl;

      // Upload new image to Cloudinary if provided
      if (imageFile) {
        newImageUrl = await uploadFileOnCloudinary(imageFile.path) || "N/A";
        
        if (!newImageUrl) {
          return res.status(500).json(
            new ApiResponse(500, {}, "Failed to upload new image. Please try again.", false)
          );
        }
      }

      // Prepare update data
      const updateData: any = {};
      if (name) updateData.name = name.trim();
      if (description !== undefined) updateData.description = description?.trim();
      if (category) updateData.category = category;
      if (price) updateData.price = price;
      if (newImageUrl) updateData.imageUrl = newImageUrl;

      const updatedSweet = await prisma.sweet.update({
        where: { id },
        data: updateData,
        include: {
          inventory: true,
          _count: {
            select: { purchases: true }
          }
        }
      });

   

      // Update cache
      const cacheKey = getCacheKey("sweet", id);
      await setCache(cacheKey, updatedSweet, 3600);
      await deleteCachePattern(`sweets:*`);

      return res.status(200).json(
        new ApiResponse(200, updatedSweet, "Sweet updated successfully", true)
      );

    } catch (error: any) {
      console.error("Update sweet error:", error);
      
      // Clean up uploaded file if error occurs
      if (req.file) {
        cleanupUploadedFiles([req.file]);
      }
      
      if (error.code === 'P2002') {
        return res.status(409).json(
          new ApiResponse(409, {}, "Sweet with this name already exists", false)
        );
      }

      return res.status(500).json(
        new ApiResponse(500, {}, "Internal server error", false)
      );
    }
  });
});

// Get all sweets with filtering and pagination (No changes needed)
const getAllSweets = AsyncHandler(async (req: Request, res: Response) => {
  try {
    const {
      page = "1",
      limit = "10",
      sort = "createdAt",
      order = "desc",
      category,
      search
    }: GetAllSweetsQuery = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const cacheKey = getCacheKey(
      "sweets",
      `${page}-${limit}-${sort}-${order}-${category || 'all'}-${search || 'none'}`
    );
    
    let cachedResult = await getCache<any>(cacheKey);

    if (!cachedResult) {
      const where: any = { isActive: true };

      if (category) {
        where.category = category;
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } }
        ];
      }

      const [sweets, totalSweets] = await Promise.all([
        prisma.sweet.findMany({
          where,
          orderBy: { [sort]: order },
          skip,
          take: limitNum,
          include: {
            inventory: {
              select: {
                quantity: true,
                minStockLevel: true,
                reorderPoint: true
              }
            },
            _count: {
              select: { purchases: true }
            }
          }
        }),
        prisma.sweet.count({ where })
      ]);

      cachedResult = {
        sweets,
        totalSweets,
        totalPages: Math.ceil(totalSweets / limitNum),
        currentPage: pageNum,
        hasNextPage: pageNum < Math.ceil(totalSweets / limitNum),
        hasPreviousPage: pageNum > 1
      };

      await setCache(cacheKey, cachedResult, 300);
    }

    return res.status(200).json(
      new ApiResponse(200, cachedResult, "Sweets retrieved successfully", true)
    );

  } catch (error) {
    console.error("Get all sweets error:", error);
    return res.status(500).json(
      new ApiResponse(500, {}, "Internal server error", false)
    );
  }
});

// ... rest of the functions remain the same (getSweet, deleteSweet, getSweetsByCategory, searchSweets)
const getSweet = AsyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json(
        new ApiResponse(400, {}, "Sweet ID is required", false)
      );
    }

    const cacheKey = getCacheKey("sweet", id);
    let sweet = await getCache<any>(cacheKey);

    if (!sweet) {
      sweet = await prisma.sweet.findUnique({
        where: { id, isActive: true },
        include: {
          inventory: true,
          _count: {
            select: { purchases: true }
          }
        }
      });

      if (!sweet) {
        return res.status(404).json(
          new ApiResponse(404, {}, "Sweet not found", false)
        );
      }

      await setCache(cacheKey, sweet, 3600);
    }

    return res.status(200).json(
      new ApiResponse(200, sweet, "Sweet retrieved successfully", true)
    );

  } catch (error) {
    console.error("Get sweet error:", error);
    return res.status(500).json(
      new ApiResponse(500, {}, "Internal server error", false)
    );
  }
});

const deleteSweet = AsyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json(
        new ApiResponse(400, {}, "Sweet ID is required", false)
      );
    }

    const sweet = await prisma.sweet.findUnique({
      where: { id, isActive: true },
      include: {
        _count: {
          select: { purchases: true }
        }
      }
    });

    if (!sweet) {
      return res.status(404).json(
        new ApiResponse(404, {}, "Sweet not found", false)
      );
    }

    if (sweet._count.purchases > 0) {
      return res.status(409).json(
        new ApiResponse(
          409, 
          { purchaseCount: sweet._count.purchases }, 
          "Cannot delete sweet with existing purchases. Consider deactivating instead.", 
          false
        )
      );
    }

    await prisma.sweet.update({
      where: { id },
      data: { isActive: false }
    });



    const cacheKey = getCacheKey("sweet", id);
    await deleteCache(cacheKey);
    await deleteCachePattern(`sweets:*`);

    return res.status(200).json(
      new ApiResponse(200, {}, "Sweet deleted successfully", true)
    );

  } catch (error) {
    console.error("Delete sweet error:", error);
    return res.status(500).json(
      new ApiResponse(500, {}, "Internal server error", false)
    );
  }
});

const getSweetsByCategory = AsyncHandler(async (req: Request, res: Response) => {
  try {
    const { category } = req.params;

    if (!Object.values(SweetCategory).includes(category as SweetCategory)) {
      return res.status(400).json(
        new ApiResponse(400, {}, "Invalid sweet category", false)
      );
    }

    const cacheKey = getCacheKey("sweets_by_category", category);
    let sweets = await getCache<any>(cacheKey);

    if (!sweets) {
      sweets = await prisma.sweet.findMany({
        where: {
          category: category as SweetCategory,
          isActive: true
        },
        include: {
          inventory: {
            select: {
              quantity: true,
              minStockLevel: true
            }
          }
        },
        orderBy: { name: 'asc' }
      });

      await setCache(cacheKey, sweets, 600);
    }

    return res.status(200).json(
      new ApiResponse(200, sweets, `Sweets in ${category} category retrieved successfully`, true)
    );

  } catch (error) {
    console.error("Get sweets by category error:", error);
    return res.status(500).json(
      new ApiResponse(500, {}, "Internal server error", false)
    );
  }
});

const searchSweets = AsyncHandler(async (req: Request, res: Response) => {
  try {
    const { q: searchTerm } = req.query;

    if (!searchTerm || typeof searchTerm !== 'string') {
      return res.status(400).json(
        new ApiResponse(400, {}, "Search term is required", false)
      );
    }

    const cacheKey = getCacheKey("search_sweets", searchTerm.toLowerCase());
    let results = await getCache<any>(cacheKey);

    if (!results) {
      results = await prisma.sweet.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: searchTerm, mode: "insensitive" } },
            { description: { contains: searchTerm, mode: "insensitive" } }
          ]
        },
        include: {
          inventory: {
            select: {
              quantity: true,
              minStockLevel: true
            }
          }
        },
        orderBy: { name: 'asc' },
        take: 20
      });

      await setCache(cacheKey, results, 300);
    }

    return res.status(200).json(
      new ApiResponse(200, results, `Search results for "${searchTerm}"`, true)
    );

  } catch (error) {
    console.error("Search sweets error:", error);
    return res.status(500).json(
      new ApiResponse(500, {}, "Internal server error", false)
    );
  }
});

export {
  createSweet,
  getAllSweets,
  getSweet,
  updateSweet,
  deleteSweet,
  getSweetsByCategory,
  searchSweets
};
