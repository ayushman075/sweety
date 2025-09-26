import { useAxiosWithAuth } from '../utils/axiosConfig';


export interface Purchase {
  id: string;
  orderNumber: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'RETURNED';
  createdAt: string;
  updatedAt: string;
  sweet: {
    id: string;
    name: string;
    category: string;
    imageUrl?: string;
  };
}

export interface CreatePurchaseData {
  sweetId: string;
  quantity: number;
}

export const usePurchaseService = () => {
  const axiosWithAuth = useAxiosWithAuth();

  const createPurchase = async (data: CreatePurchaseData) => {
    const response = await axiosWithAuth.post('/purchases', data);
    return response.data;
  };

  const getUserPurchases = async (params?: {
    page?: number;
    limit?: number;
    status?: string;
  }) => {
    const response = await axiosWithAuth.get('/purchases/my-purchases', { params });
    return response.data;
  };

  const getPurchaseById = async (id: string) => {
    const response = await axiosWithAuth.get(`/purchases/${id}`);
    return response.data;
  };

  const cancelPurchase = async (id: string) => {
    const response = await axiosWithAuth.put(`/purchases/${id}/cancel`);
    return response.data;
  };

  // Admin only
  const getAllPurchases = async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    userId?: string;
  }) => {
    const response = await axiosWithAuth.get('/purchases', { params });
    return response.data;
  };

  const updatePurchaseStatus = async (id: string, status: string) => {
    const response = await axiosWithAuth.put(`/purchases/${id}/status`, { status });
    return response.data;
  };

  const getPurchaseStats = async (days?: number) => {
    const response = await axiosWithAuth.get('/purchases/stats/overview', {
      params: { days }
    });
    return response.data;
  };

  return {
    createPurchase,
    getUserPurchases,
    getPurchaseById,
    cancelPurchase,
    getAllPurchases,
    updatePurchaseStatus,
    getPurchaseStats,
  };
};
