import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin, Result, Button } from 'antd';
import { UserOutlined, LockOutlined, LoadingOutlined } from '@ant-design/icons';
import { useAuth } from '../components/context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  fallbackPath?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAdmin = false,
  fallbackPath = '/login'
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Show enhanced loading screen while checking authentication
 if (isLoading) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50">
      <div className="flex flex-col items-center text-center">
        {/* Logo with subtle spin ring */}
        <div className="relative mb-6">
          <div className="absolute inset-0 w-20 h-20 border-4 border-purple-200 rounded-full"></div>
          <div className="absolute inset-0 w-20 h-20 border-4 border-transparent border-t-purple-600 rounded-full animate-spin"></div>
          <div className="relative flex items-center justify-center w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full shadow-lg">
            <span className="text-3xl">🍬</span>
          </div>
        </div>

        {/* Loading Text */}
        <h2 className="text-xl font-semibold text-gray-800 animate-pulse">
          Loading Sweet Shop...
        </h2>
        <p className="text-gray-500 text-sm mt-2">
          Please wait while we verify your access
        </p>
      </div>
    </div>
  );
}


  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  // Enhanced admin requirement check
  if (requireAdmin && user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-orange-50 to-pink-50 p-4 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-16 animate-pulse" style={{animationDelay: '1s'}}>
            <span className="text-2xl opacity-20">🚫</span>
          </div>
          <div className="absolute bottom-24 right-20 animate-bounce" style={{animationDelay: '0.5s', animationDuration: '4s'}}>
            <span className="text-xl opacity-15">⚠️</span>
          </div>
        </div>

        <div className="max-w-md w-full relative z-10">
          <div className="bg-white rounded-3xl shadow-2xl p-8 backdrop-blur-sm bg-white/95 border border-red-100">
            {/* Enhanced Icon */}
            <div className="text-center mb-6">
              <div className="relative inline-block">
                <div className="absolute inset-0 w-20 h-20 bg-gradient-to-r from-red-500 to-orange-600 rounded-full animate-pulse opacity-20"></div>
                <div className="relative inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-red-500 to-orange-600 rounded-full shadow-lg">
                  <LockOutlined className="text-3xl text-white animate-bounce" />
                </div>
              </div>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">🔒 Access Restricted</h2>
              <p className="text-gray-600">You need administrator privileges to access this page.</p>
            </div>

            {/* User Info Card */}
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl p-4 mb-6 border border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                  <UserOutlined className="text-white text-lg" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">{user?.name}</p>
                  <p className="text-sm text-gray-600">{user?.email}</p>
                  <div className="flex items-center mt-1">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      {user?.role === 'ADMIN' ? '👑 Administrator' : '👤 User'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button 
                type="primary" 
                block
                onClick={() => window.location.href = '/dashboard'}
                className="h-12 bg-gradient-to-r from-purple-500 to-pink-600 border-0 hover:from-purple-600 hover:to-pink-700 rounded-xl font-semibold shadow-lg"
                size="large"
              >
                🏠 Go to Dashboard
              </Button>
              <Button 
                block
                onClick={() => window.location.href = 'mailto:admin@sweetshop.com'}
                className="h-12 rounded-xl font-medium border-2 border-gray-200 hover:border-purple-400 hover:bg-purple-50"
                size="large"
              >
                📧 Contact Admin
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Enhanced inactive account check
  if (user && !user.isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 p-4 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0">
          <div className="absolute top-16 left-20 animate-pulse" style={{animationDelay: '0.5s'}}>
            <span className="text-2xl opacity-20">⚠️</span>
          </div>
          <div className="absolute bottom-20 right-16 animate-bounce" style={{animationDelay: '1.5s', animationDuration: '3s'}}>
            <span className="text-xl opacity-15">🔒</span>
          </div>
        </div>

        <div className="max-w-md w-full relative z-10">
          <div className="bg-white rounded-3xl shadow-2xl p-8 backdrop-blur-sm bg-white/95 border border-yellow-100">
            {/* Enhanced Warning Icon */}
            <div className="text-center mb-6">
              <div className="relative inline-block">
                <div className="absolute inset-0 w-20 h-20 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-full animate-pulse opacity-20"></div>
                <div className="relative inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-full shadow-lg">
                  <UserOutlined className="text-3xl text-white animate-bounce" />
                </div>
              </div>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">⚠️ Account Deactivated</h2>
              <p className="text-gray-600">Your account has been temporarily deactivated. Please contact support for assistance.</p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button 
                type="primary" 
                block
                onClick={() => window.location.href = 'mailto:support@sweetshop.com'}
                className="h-12 bg-gradient-to-r from-yellow-500 to-orange-600 border-0 hover:from-yellow-600 hover:to-orange-700 rounded-xl font-semibold shadow-lg"
                size="large"
              >
                📞 Contact Support
              </Button>
              <Button 
                block
                onClick={() => window.location.href = '/login'}
                className="h-12 rounded-xl font-medium border-2 border-gray-200 hover:border-orange-400 hover:bg-orange-50"
                size="large"
              >
                🚪 Logout
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render protected content
  return <>{children}</>;
};

export default ProtectedRoute;