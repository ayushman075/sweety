/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import axios, { type AxiosResponse } from 'axios';
import Cookies from 'js-cookie';
import { message } from 'antd';

// Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  isActive: boolean;
  createdAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
    refreshToken?: string;
  };
  message: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Create a separate axios instance for auth operations (without interceptors to avoid loops)
const authApiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
});

// Token management constants
const TOKEN_KEY = 'sweet_shop_token';
const REFRESH_TOKEN_KEY = 'sweet_shop_refresh_token';
const USER_KEY = 'sweet_shop_user';

// Token management functions
const getStoredToken = (): string | null => {
  return Cookies.get(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
};

const getStoredRefreshToken = (): string | null => {
  return Cookies.get(REFRESH_TOKEN_KEY) || localStorage.getItem(REFRESH_TOKEN_KEY);
};

const getStoredUser = (): User | null => {
  const userStr = localStorage.getItem(USER_KEY);
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
  return null;
};

const setAuthData = (token: string, user: User, refreshToken?: string) => {
  // Store in both cookies and localStorage
  const cookieOptions = { 
    expires: 7, 
    secure: window.location.protocol === 'https:', 
    sameSite: 'strict' as const 
  };
  
  Cookies.set(TOKEN_KEY, token, cookieOptions);
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  
  if (refreshToken) {
    Cookies.set(REFRESH_TOKEN_KEY, refreshToken, { ...cookieOptions, expires: 30 });
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
};

const clearAuthData = () => {
  Cookies.remove(TOKEN_KEY);
  Cookies.remove(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user && !!token;

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = () => {
      const storedToken = getStoredToken();
      const storedUser = getStoredUser();

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(storedUser);
      }

      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const handleLogin = async (credentials: LoginCredentials): Promise<void> => {
    try {
      setIsLoading(true);

      const response: AxiosResponse<AuthResponse> = await authApiClient.post('/auth/login', credentials);
      
      if (response.data.success) {
        const { user: userData, token: userToken, refreshToken: userRefreshToken } = response.data.data;
        
        setUser(userData);
        setToken(userToken);
        setAuthData(userToken, userData, userRefreshToken);
        
        message.success('Login successful! Welcome back.');
      } else {
        throw new Error(response.data.message || 'Login failed');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Login failed. Please try again.';
      message.error(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (data: RegisterData): Promise<void> => {
    try {
      setIsLoading(true);

      const response: AxiosResponse<AuthResponse> = await authApiClient.post('/auth/register', data);
      
      if (response.data.success) {
        const { user: userData, token: userToken, refreshToken: userRefreshToken } = response.data.data;
        
        setUser(userData);
        setToken(userToken);
        setAuthData(userToken, userData, userRefreshToken);
        
        message.success('Registration successful! Welcome to Sweet Shop.');
      } else {
        throw new Error(response.data.message || 'Registration failed');
      }
    } catch (error: unknown) {
      const errorMessage = (error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message 
        || (error instanceof Error ? error.message : 'Registration failed. Please try again.');
      message.error(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshToken = async (): Promise<void> => {
    try {
      const storedRefreshToken = getStoredRefreshToken();
      
      if (!storedRefreshToken) {
        throw new Error('No refresh token available');
      }

      const response: AxiosResponse<AuthResponse> = await authApiClient.post('/auth/refresh-token', {
        refreshToken: storedRefreshToken
      });
      
      if (response.data.success) {
        const { user: userData, token: newToken, refreshToken: newRefreshToken } = response.data.data;
        
        setUser(userData);
        setToken(newToken);
        setAuthData(newToken, userData, newRefreshToken);
      } else {
        throw new Error('Token refresh failed');
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Clear auth data on refresh failure
      handleLogout();
      throw error;
    }
  };

  const handleLogout = async (): Promise<void> => {
    try {
      setIsLoading(true);
      
      // Call logout API if user is authenticated
      if (token) {
        await authApiClient.post('/auth/logout', {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error('Logout API error:', error);
      // Continue with logout even if API call fails
    } finally {
      // Always clear local state and storage
      setUser(null);
      setToken(null);
      clearAuthData();
      setIsLoading(false);
      message.success('Logged out successfully');
    }
  };

  const contextValue: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    refreshToken: handleRefreshToken,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
