import axios, { type AxiosInstance } from 'axios';
import { useAuth } from '../components/context/AuthContext';
import { message } from 'antd';

export const useAxiosWithAuth = (): AxiosInstance => {
  const { token, refreshToken, logout } = useAuth();
  
  const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: true,
    timeout: 30000, // 30 second timeout
  });

  // Request interceptor to add auth token
  axiosInstance.interceptors.request.use(
    async (config) => {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor for error handling and token refresh
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      // Handle 401 errors (unauthorized)
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          await refreshToken();
          // Retry the original request with new token
          const newToken = localStorage.getItem('sweet_shop_token');
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return axiosInstance(originalRequest);
          }
        } catch (refreshError) {
          // Refresh failed, logout user
          message.error('Session expired. Please login again.');
          await logout();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }

      // Handle other errors
      if (error.response?.data?.message) {
        message.error(error.response.data.message);
      } else if (error.message) {
        message.error(error.message);
      }

      return Promise.reject(error);
    }
  );

  return axiosInstance;
};

export const useAxiosWithAuthFile = (): AxiosInstance => {
  const { token, refreshToken, logout } = useAuth();
  
  const axiosInstanceFile = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
    headers: {
      // Don't set Content-Type for file uploads - let browser set it with boundary
    },
    withCredentials: true,
    timeout: 60000, // 60 second timeout for file uploads
  });

  // Request interceptor to add auth token
  axiosInstanceFile.interceptors.request.use(
    async (config) => {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor for error handling and token refresh
  axiosInstanceFile.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      // Handle 401 errors (unauthorized)
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          await refreshToken();
          // Retry the original request with new token
          const newToken = localStorage.getItem('sweet_shop_token');
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return axiosInstanceFile(originalRequest);
          }
        } catch (refreshError) {
          // Refresh failed, logout user
          message.error('Session expired. Please login again.');
          await logout();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }

      // Handle file upload specific errors
      if (error.code === 'ECONNABORTED') {
        message.error('File upload timeout. Please try again with a smaller file.');
      } else if (error.response?.data?.message) {
        message.error(error.response.data.message);
      } else if (error.message) {
        message.error(error.message);
      }

      return Promise.reject(error);
    }
  );

  return axiosInstanceFile;
};
