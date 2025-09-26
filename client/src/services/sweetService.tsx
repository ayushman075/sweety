import { useAxiosWithAuth, useAxiosWithAuthFile } from '../utils/axiosConfig';

export interface Sweet {
  id: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  inventory?: {
    quantity: number;
    minStockLevel: number;
    reorderPoint: number;
  };
}

export interface CreateSweetData {
  name: string;
  description?: string;
  category: string;
  price: number;
  quantity: number;
  image?: File;
}

export interface SweetListResponse {
  success: boolean;
  data: {
    sweets: Sweet[];
    totalSweets: number;
    totalPages: number;
    currentPage: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  message: string;
}

export const useSweetService = () => {
  const axiosWithAuth = useAxiosWithAuth();
  const axiosWithAuthFile = useAxiosWithAuthFile();

  const getAllSweets = async (params?: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
  }) => {
    const response = await axiosWithAuth.get('/sweet', { params });
    return response.data as SweetListResponse;
  };

  const getSweetById = async (id: string) => {
    const response = await axiosWithAuth.get(`/sweet/${id}`);
    return response.data;
  };

  const createSweet = async (data: CreateSweetData) => {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('category', data.category);
    formData.append('price', data.price.toString());
    formData.append('quantity', data.quantity.toString());
    
    if (data.description) {
      formData.append('description', data.description);
    }
    
    if (data.image) {
      formData.append('image', data.image);
    }

    const response = await axiosWithAuthFile.post('/sweet', formData);
    return response.data;
  };

  const updateSweet = async (id: string, data: Partial<CreateSweetData>) => {
    const formData = new FormData();
    
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && key !== 'image') {
        formData.append(key, value.toString());
      }
    });
    
    if (data.image) {
      formData.append('image', data.image);
    }

    const response = await axiosWithAuthFile.put(`/sweet/${id}`, formData);
    return response.data;
  };

  const deleteSweet = async (id: string) => {
    const response = await axiosWithAuth.delete(`/sweet/${id}`);
    return response.data;
  };

  return {
    getAllSweets,
    getSweetById,
    createSweet,
    updateSweet,
    deleteSweet,
  };
};
