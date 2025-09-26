import { useAxiosWithAuth, useAxiosWithAuthFile } from '../utils/axiosConfig';


// Types
export interface StockMovement {
  id: string;
  type: 'RESTOCK' | 'RETURN';
  quantity: number;
  reason?: string;
  reference?: string;
  createdAt: string;
  inventory: {
    id: string;
    quantity: number;
    sweet: {
      id: string;
      name: string;
      category: string;
      imageUrl?: string;
    };
  };
}

export interface InventoryItem {
  id: string;
  quantity: number;
  minStockLevel: number;
  maxStockLevel: number;
  reorderPoint: number;
  lastRestockedAt?: string;
  sweet: {
    id: string;
    name: string;
    category: string;
    price: number;
    imageUrl?: string;
  };
}

export interface InventoryStats {
  totalItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  overstockedItems: number;
  totalQuantity: number;
  totalValue: number;
  averageQuantityPerItem: number;
}

export interface StockMovementParams {
  page?: number;
  limit?: number;
  sweetId?: string;
  type?: 'RESTOCK' | 'RETURN';
  sort?: string;
  order?: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
}

export interface RestockData {
  quantity: number;
  reason?: string;
}

export interface UpdateInventoryData {
  quantity?: number;
  minStockLevel?: number;
  maxStockLevel?: number;
  reorderPoint?: number;
}

export interface StockMovementResponse {
  success: boolean;
  data: {
    movements: StockMovement[];
    totalMovements: number;
    totalPages: number;
    currentPage: number;
    movementSummary: Array<{
      type: string;
      _sum: { quantity: number };
      _count: number;
    }>;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  message: string;
}

export interface InventoryStatusResponse {
  success: boolean;
  data: {
    inventory: InventoryItem[];
    stats: InventoryStats;
  };
  message: string;
}

export interface LowStockResponse {
  success: boolean;
  data: InventoryItem[];
  message: string;
}

export interface SweetInventoryResponse {
  success: boolean;
  data: InventoryItem & {
    totalMovements: number;
    movementStats: Array<{
      type: string;
      _sum: { quantity: number };
      _count: number;
    }>;
    stockStatus: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'OVERSTOCKED' | 'NORMAL';
    daysUntilRestock?: number;
  };
  message: string;
}

export interface RestockResponse {
  success: boolean;
  data: {
    sweet: {
      id: string;
      name: string;
      category: string;
    };
    inventory: InventoryItem;
    stockMovement: StockMovement;
    previousQuantity: number;
    newQuantity: number;
  };
  message: string;
}

export const useStockMovementService = () => {
  const axiosWithAuth = useAxiosWithAuth();

  /**
   * Get stock movements with filtering and pagination
   */
  const getStockMovements = async (params?: StockMovementParams): Promise<StockMovementResponse> => {
    try {
      const response = await axiosWithAuth.get('/inventory/movements', { params });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch stock movements:', error);
      throw error;
    }
  };

  /**
   * Get complete inventory status with statistics
   */
  const getInventoryStatus = async (): Promise<InventoryStatusResponse> => {
    try {
      const response = await axiosWithAuth.get('/inventory');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch inventory status:', error);
      throw error;
    }
  };

  /**
   * Get items that are low on stock or out of stock
   */
  const getLowStockItems = async (): Promise<LowStockResponse> => {
    try {
      const response = await axiosWithAuth.get('/inventory/low-stock');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch low stock items:', error);
      throw error;
    }
  };

  /**
   * Get inventory details for a specific sweet
   */
  const getSweetInventory = async (sweetId: string): Promise<SweetInventoryResponse> => {
    try {
      const response = await axiosWithAuth.get(`/inventory/${sweetId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch sweet inventory:', error);
      throw error;
    }
  };

  /**
   * Restock a sweet with specified quantity
   */
  const restockSweet = async (sweetId: string, data: RestockData): Promise<RestockResponse> => {
    try {
      const response = await axiosWithAuth.post(`/inventory/${sweetId}/restock`, data);
      return response.data;
    } catch (error) {
      console.error('Failed to restock sweet:', error);
      throw error;
    }
  };

  /**
   * Update inventory settings (stock levels, reorder points)
   */
  const updateInventory = async (sweetId: string, data: UpdateInventoryData) => {
    try {
      const response = await axiosWithAuth.put(`/inventory/${sweetId}`, data);
      return response.data;
    } catch (error) {
      console.error('Failed to update inventory:', error);
      throw error;
    }
  };

  /**
   * Get inventory movements for a specific sweet
   */
  const getSweetMovements = async (sweetId: string, params?: Omit<StockMovementParams, 'sweetId'>) => {
    try {
      const response = await axiosWithAuth.get('/inventory/movements', {
        params: { ...params, sweetId }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch sweet movements:', error);
      throw error;
    }
  };

  /**
   * Export stock movement data
   */
  const exportStockMovements = async (params?: StockMovementParams) => {
    try {
      const response = await axiosWithAuth.get('/inventory/movements/export', {
        params,
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Failed to export stock movements:', error);
      throw error;
    }
  };

  /**
   * Get inventory analytics/statistics
   */
  const getInventoryAnalytics = async (days?: number) => {
    try {
      const response = await axiosWithAuth.get('/inventory/analytics', {
        params: { days }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch inventory analytics:', error);
      throw error;
    }
  };

  /**
   * Bulk restock multiple items
   */
  const bulkRestock = async (items: Array<{ sweetId: string; quantity: number; reason?: string }>) => {
    try {
      const response = await axiosWithAuth.post('/inventory/bulk-restock', { items });
      return response.data;
    } catch (error) {
      console.error('Failed to bulk restock items:', error);
      throw error;
    }
  };

  /**
   * Get stock movement summary by date range
   */
  const getMovementSummary = async (startDate?: string, endDate?: string) => {
    try {
      const response = await axiosWithAuth.get('/inventory/movements/summary', {
        params: { startDate, endDate }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch movement summary:', error);
      throw error;
    }
  };

  /**
   * Get items that need reordering
   */
  const getReorderAlerts = async () => {
    try {
      const response = await axiosWithAuth.get('/inventory/reorder-alerts');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch reorder alerts:', error);
      throw error;
    }
  };

  /**
   * Update multiple inventory items at once
   */
  const bulkUpdateInventory = async (updates: Array<{ sweetId: string; data: UpdateInventoryData }>) => {
    try {
      const response = await axiosWithAuth.put('/inventory/bulk-update', { updates });
      return response.data;
    } catch (error) {
      console.error('Failed to bulk update inventory:', error);
      throw error;
    }
  };

  /**
   * Get inventory value report
   */
  const getInventoryValueReport = async () => {
    try {
      const response = await axiosWithAuth.get('/inventory/value-report');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch inventory value report:', error);
      throw error;
    }
  };

  return {
    // Core inventory operations
    getStockMovements,
    getInventoryStatus,
    getLowStockItems,
    getSweetInventory,
    restockSweet,
    updateInventory,
    
    // Movement tracking
    getSweetMovements,
    getMovementSummary,
    
    // Analytics and reporting
    getInventoryAnalytics,
    getInventoryValueReport,
    getReorderAlerts,
    
    // Bulk operations
    bulkRestock,
    bulkUpdateInventory,
    
    // Export functionality
    exportStockMovements
  };
};

// Utility functions for stock management
export const stockUtils = {
  /**
   * Calculate stock status based on current quantity and thresholds
   */
  getStockStatus: (quantity: number, reorderPoint: number, maxStockLevel: number) => {
    if (quantity === 0) {
      return { status: 'OUT_OF_STOCK', color: 'red', icon: '❌', urgency: 'critical' };
    } else if (quantity <= reorderPoint) {
      return { status: 'LOW_STOCK', color: 'orange', icon: '⚠️', urgency: 'high' };
    } else if (quantity > maxStockLevel) {
      return { status: 'OVERSTOCKED', color: 'purple', icon: '📦', urgency: 'low' };
    } else {
      return { status: 'NORMAL', color: 'green', icon: '✅', urgency: 'none' };
    }
  },

  /**
   * Calculate recommended restock quantity
   */
  getRecommendedRestockQuantity: (
    currentQuantity: number, 
    minStockLevel: number, 
    maxStockLevel: number,
    averageDailyUsage?: number
  ) => {
    const targetQuantity = Math.floor((minStockLevel + maxStockLevel) / 2);
    const baseRestock = Math.max(0, targetQuantity - currentQuantity);
    
    // If we have usage data, consider it
    if (averageDailyUsage && averageDailyUsage > 0) {
      const daysOfStock = currentQuantity / averageDailyUsage;
      if (daysOfStock < 7) { // Less than a week of stock
        return Math.max(baseRestock, averageDailyUsage * 14); // Restock for 2 weeks
      }
    }
    
    return baseRestock;
  },

  /**
   * Format quantity with units
   */
  formatQuantity: (quantity: number) => {
    if (quantity >= 1000) {
      return `${(quantity / 1000).toFixed(1)}k units`;
    }
    return `${quantity} units`;
  },

  /**
   * Get days since last restock
   */
  getDaysSinceRestock: (lastRestockedAt?: string) => {
    if (!lastRestockedAt) return null;
    const now = new Date();
    const lastRestock = new Date(lastRestockedAt);
    const diffTime = Math.abs(now.getTime() - lastRestock.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  /**
   * Calculate inventory turnover rate
   */
  calculateTurnoverRate: (sold: number, averageInventory: number) => {
    if (averageInventory === 0) return 0;
    return sold / averageInventory;
  }
};

export default useStockMovementService;
