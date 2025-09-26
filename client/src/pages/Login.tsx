/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Divider, Space, Alert, Checkbox } from 'antd';
import { Mail, Lock, Eye, EyeOff, Crown, User } from 'lucide-react';
import { useAuth, type LoginCredentials } from '../components/context/AuthContext';

const { Title, Text } = Typography;

const Login: React.FC = () => {
  const [form] = Form.useForm();
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string>('');

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const handleSubmit = async (values: LoginCredentials) => {
    try {
      setError('');
      await login(values);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    }
  };

  const demoCredentials = {
    admin: { email: 'admin@sweetshop.com', password: 'admin123' },
    user: { email: 'user@sweetshop.com', password: 'password123' }
  };

  const fillDemoCredentials = (type: 'admin' | 'user') => {
    form.setFieldsValue(demoCredentials[type]);
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 overflow-hidden">
      {/* Branding Section - Left */}
      <div className="flex flex-col items-center justify-center bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-600 text-white p-5 relative overflow-hidden">
        {/* Floating Elements Animation */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 animate-pulse">
            <span className="text-2xl opacity-30">🍭</span>
          </div>
          <div className="absolute top-40 right-16 animate-bounce" style={{animationDelay: '1s', animationDuration: '3s'}}>
            <span className="text-xl opacity-20">🧁</span>
          </div>
          <div className="absolute bottom-40 left-20 animate-pulse" style={{animationDelay: '2s'}}>
            <span className="text-lg opacity-25">🍪</span>
          </div>
          <div className="absolute bottom-20 right-10 animate-bounce" style={{animationDelay: '0.5s', animationDuration: '4s'}}>
            <span className="text-2xl opacity-20">🎂</span>
          </div>
          <div className="absolute top-60 left-1/2 transform -translate-x-1/2 animate-pulse" style={{animationDelay: '1.5s'}}>
            <span className="text-lg opacity-30">🍩</span>
          </div>
        </div>

        <div className="flex flex-col items-center text-center relative z-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-full mb-3 shadow-lg animate-pulse">
            <span className="text-3xl">🍬</span>
          </div>
          <Title level={1} className="!text-white mb-3 animate-fade-in">
            Sweety
          </Title>
          <Text className="text-base !text-white/90 animate-fade-in" style={{animationDelay: '0.3s'}}>
            Manage your sweets business with ease
          </Text>
        </div>

        <style jsx>{`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in {
            animation: fade-in 0.8s ease-out forwards;
            opacity: 0;
          }
        `}</style>
      </div>

      {/* Login Form Section - Right */}
      <div className="flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 p-4">
        <div className="w-full max-w-md">
          <Card className="shadow-2xl border-0 rounded-2xl backdrop-blur-sm bg-white/95">
            <div className="p-4">
              {/* Welcome Text */}
              <div className="text-center mb-3">
                <Title level={4} className="mb-1 text-gray-800">
                  Welcome Back! 👋
                </Title>
                <Text type="secondary" className="text-sm">
                  Enter your credentials to access your account
                </Text>
              </div>

              {/* Error Alert */}
              {error && (
                <Alert
                  message={error}
                  type="error"
                  className="mb-3 rounded-xl"
                  showIcon
                  closable
                  onClose={() => setError('')}
                />
              )}

              {/* Login Form */}
              <Form
                form={form}
                name="login"
                onFinish={handleSubmit}
                layout="vertical"
                size="middle"
                className="space-y-0"
              >
                <Form.Item
                  name="email"
                  label={<span className="text-gray-700 font-medium text-sm">Email Address</span>}
                  rules={[
                    { required: true, message: 'Please enter your email!' },
                    { type: 'email', message: 'Please enter a valid email!' }
                  ]}
                  className="mb-3"
                >
                  <Input
                    prefix={<Mail className="text-gray-400 w-4 h-4 mr-2" />}
                    placeholder="Enter your email address"
                    className="rounded-xl py-2 px-3 border-gray-200 hover:border-purple-400 focus:border-purple-500"
                  />
                </Form.Item>

                <Form.Item
                  name="password"
                  label={<span className="text-gray-700 font-medium text-sm">Password</span>}
                  rules={[
                    { required: true, message: 'Please enter your password!' },
                    { min: 6, message: 'Password must be at least 6 characters!' }
                  ]}
                  className="mb-3"
                >
                  <Input.Password
                    prefix={<Lock className="text-gray-400 w-4 h-4 mr-2" />}
                    placeholder="Enter your password"
                    iconRender={(visible) =>
                      visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />
                    }
                    className="rounded-xl py-2 px-3 border-gray-200 hover:border-purple-400 focus:border-purple-500"
                  />
                </Form.Item>

                {/* Remember Me & Forgot Password */}
                <div className="flex justify-between items-center mb-3">
                  <Form.Item name="remember" valuePropName="checked" noStyle>
                    <Checkbox className="text-gray-600 text-sm">Remember me</Checkbox>
                  </Form.Item>
                  <Link 
                    to="#" 
                    className="text-purple-600 hover:text-purple-700 text-xs font-medium"
                  >
                    Forgot password?
                  </Link>
                </div>

                {/* Login Button */}
                <Form.Item className="mb-3">
                  <Button
                    type="primary"
                    htmlType="submit"
                    className="w-full h-10 rounded-xl bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-600 border-0 hover:from-pink-600 hover:via-purple-600 hover:to-indigo-700 shadow-lg font-semibold"
                    loading={isLoading}
                  >
                    {isLoading ? 'Signing In...' : 'Sign In'}
                  </Button>
                </Form.Item>
              </Form>

              {/* Demo Accounts Section */}
              <Divider className="my-4">
                <span className="text-gray-500 bg-white px-3 text-xs font-medium">Try Demo Accounts</span>
              </Divider>

              <Space direction="vertical" className="w-full" size="small">
                <Button
                  type="dashed"
                  onClick={() => fillDemoCredentials('admin')}
                  className="w-full rounded-xl h-9 border-2 border-dashed border-purple-300 hover:border-purple-500 hover:bg-purple-50 transition-all duration-200"
                  icon={<Crown className="w-3 h-3 text-purple-600" />}
                >
                  <span className="font-medium text-gray-700 text-sm">Try Admin Account</span>
                </Button>
                <Button
                  type="dashed"
                  onClick={() => fillDemoCredentials('user')}
                  className="w-full rounded-xl h-9 border-2 border-dashed border-blue-300 hover:border-blue-500 hover:bg-blue-50 transition-all duration-200"
                  icon={<User className="w-3 h-3 text-blue-600" />}
                >
                  <span className="font-medium text-gray-700 text-sm">Try User Account</span>
                </Button>
              </Space>

              {/* Sign Up Link */}
              <div className="text-center mt-4">
                <Text type="secondary" className="text-sm">
                  Don't have an account?{' '}
                  <Link
                    to="/register"
                    className="text-purple-600 hover:text-purple-700 font-semibold hover:underline transition-all duration-200"
                  >
                    Create one here
                  </Link>
                </Text>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Login;