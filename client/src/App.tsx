import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { AuthProvider, useAuth } from './components/context/AuthContext';
import ProtectedRoute from './components/ProtectedRoutes';
import Login from './pages/Login';
import Register from './pages/Register';
import Sweets from './pages/Sweets';
import AddSweet from './pages/AddSweet';
import PurchaseManagement from './pages/PurchaseManagement';
import StockMovement from './pages/StockMovement';
//import Dashboard from './pages/Dashboard';

// Ant Design theme configuration
const theme = {
  token: {
    colorPrimary: '#722ed1',
    borderRadius: 8,
    wireframe: false,
  },
  components: {
    Button: {
      borderRadius: 8,
    },
    Input: {
      borderRadius: 8,
    },
    Card: {
      borderRadius: 12,
    },
  },
};

// Landing page component
const LandingPage: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-purple-50">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full mb-4 animate-pulse">
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
};

// App Routes Component
const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Sweets/> 
          </ProtectedRoute>
        }
      />

      {/* Admin Only Routes */}
      <Route
        path="/admin/sweets/create"
        element={
          <ProtectedRoute requireAdmin={true}>
           <AddSweet/>
          </ProtectedRoute>
        }
      />
        <Route
        path="/admin/purchases"
        element={
          <ProtectedRoute requireAdmin={true}>
           <PurchaseManagement/>
          </ProtectedRoute>
        }
      />


<Route
        path="/admin/inventory"
        element={
          <ProtectedRoute requireAdmin={true}>
           <StockMovement/>
          </ProtectedRoute>
        }
      />
      {/* Sweets Routes - Future Implementation */}
      <Route
        path="/sweets/"
        element={
          <ProtectedRoute>
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="text-center p-8">
                <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-3xl">🍭</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Sweet Catalog</h2>
                <p className="text-gray-600">Browse and manage sweets - Coming soon...</p>
              </div>
            </div>
          </ProtectedRoute>
        }
      />

      {/* Orders Routes - Future Implementation */}
      <Route
        path="/orders/*"
        element={
          <ProtectedRoute>
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="text-center p-8">
                <div className="w-20 h-20 bg-gradient-to-r from-orange-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-3xl">🛒</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">My Orders</h2>
                <p className="text-gray-600">Track your sweet orders - Coming soon...</p>
              </div>
            </div>
          </ProtectedRoute>
        }
      />

      {/* Profile Routes - Future Implementation */}
      <Route
        path="/profile/*"
        element={
          <ProtectedRoute>
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="text-center p-8">
                <div className="w-20 h-20 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-3xl">👤</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Profile Settings</h2>
                <p className="text-gray-600">Manage your account - Coming soon...</p>
              </div>
            </div>
          </ProtectedRoute>
        }
      />

      {/* Fallback Route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

// Main App Component
const App: React.FC = () => {
  return (
    <ConfigProvider theme={theme}>
      <AuthProvider>
        <Router>
          <div className="App">
            <AppRoutes />
          </div>
        </Router>
      </AuthProvider>
    </ConfigProvider>
  );
};

export default App;
