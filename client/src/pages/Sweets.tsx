import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Input, 
  Select, 
  Button, 
  Row, 
  Col, 
  Pagination, 
  Empty, 
  Spin, 
  Tag, 
  Avatar,
  Typography,
  Space,
  Dropdown,
  Modal,
  Form,
  InputNumber,
  message
} from 'antd';
import type { MenuProps } from 'antd';
import { 
  SearchOutlined, 
  FilterOutlined, 
  PlusOutlined,
  ShoppingCartOutlined,
  LogoutOutlined,
  UserOutlined,
  DownOutlined,
  AppstoreOutlined,
  BarsOutlined,
  EditOutlined
} from '@ant-design/icons';
import { useSweetService } from '@/services/sweetService';
import { useAuth } from '@/components/context/AuthContext';
import { usePurchaseService } from '@/services/purchaseService';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;
const { Option } = Select;

// Simplified categories [web:24][web:26]
const SWEET_CATEGORIES = [
  'CHOCOLATES',
  'CANDIES', 
  'CAKES',
  'COOKIES',
  'PASTRIES',
  'ICE_CREAM'
];

const CATEGORY_EMOJIS: Record<string, string> = {
  CHOCOLATES: '🍫',
  CANDIES: '🍬',
  CAKES: '🎂',
  COOKIES: '🍪',
  PASTRIES: '🥐',
  ICE_CREAM: '🍦'
};

interface Sweet {
  id: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  imageUrl?: string;
  isActive: boolean;
  inventory?: {
    quantity: number;
    minStockLevel: number;
    reorderPoint: number;
  };
}

interface PurchaseFormValues {
  quantity: number;
}

const Sweets: React.FC = () => {
  const { user, logout } = useAuth();
  const { getAllSweets } = useSweetService();
  const { createPurchase } = usePurchaseService();
  const navigate = useNavigate();

  // Simplified state [web:24]
  const [sweets, setSweets] = useState<Sweet[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalSweets, setTotalSweets] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Purchase modal state
  const [purchaseModalVisible, setPurchaseModalVisible] = useState(false);
  const [selectedSweet, setSelectedSweet] = useState<Sweet | null>(null);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseForm] = Form.useForm<PurchaseFormValues>();

  const isAdmin = user?.role === 'ADMIN';
  const pageSize = 12;

  // Fetch sweets
  const fetchSweets = async () => {
    try {
      setLoading(true);
      const response = await getAllSweets({
        page: currentPage,
        limit: pageSize,
        category: selectedCategory,
        search: searchTerm || undefined
      });

      if (response.success) {
        setSweets(response.data.sweets);
        setTotalSweets(response.data.totalSweets);
      }
    } catch (error) {
      message.error('Failed to load sweets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSweets();
  }, [currentPage, selectedCategory, searchTerm]);

  // Handlers
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
      message.success('Logged out successfully');
    } catch (error) {
      message.error('Failed to logout');
    }
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleCategoryChange = (category: string | undefined) => {
    setSelectedCategory(category);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleOpenPurchaseModal = (sweet: Sweet) => {
    setSelectedSweet(sweet);
    setPurchaseModalVisible(true);
    purchaseForm.setFieldsValue({ quantity: 1 });
  };

  const handleClosePurchaseModal = () => {
    setPurchaseModalVisible(false);
    setSelectedSweet(null);
    purchaseForm.resetFields();
  };

  const handlePurchase = async (values: PurchaseFormValues) => {
    if (!selectedSweet) return;
    
    try {
      setPurchaseLoading(true);
      await createPurchase({
        sweetId: selectedSweet.id,
        quantity: values.quantity
      });
      message.success(`Successfully purchased ${values.quantity} ${selectedSweet.name}(s)!`);
      handleClosePurchaseModal();
      fetchSweets();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Purchase failed');
    } finally {
      setPurchaseLoading(false);
    }
  };

  // User menu items [web:27]
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      label: 'Profile',
      icon: <UserOutlined />,
      onClick: () => navigate('/profile')
    },
    {
      key: 'orders',
      label: 'Orders',
      icon: <ShoppingCartOutlined />,
      onClick: () => navigate('/orders')
    },
    ...(isAdmin ? [
      { type: 'divider' as const },
      {
        key: 'admin',
        label: 'Admin Panel',
        onClick: () => navigate('/admin')
      }
    ] : []),
    { type: 'divider' as const },
    {
      key: 'logout',
      label: 'Logout',
      icon: <LogoutOutlined />,
      onClick: handleLogout
    }
  ];

  // Clean card design [web:24][web:26]
  const renderSweetCard = (sweet: Sweet) => {
    const isOutOfStock = sweet.inventory?.quantity === 0;
    const isLowStock = sweet.inventory && sweet.inventory.quantity <= sweet.inventory.reorderPoint;

    return (
      <Card
        key={sweet.id}
        hoverable
        className={`
          rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200
          ${isOutOfStock ? 'opacity-50' : ''}
        `}
        cover={
          <div className="relative">
            <img
              alt={sweet.name}
              src={sweet.imageUrl || '/api/placeholder/300/200'}
              className="h-48 w-full object-cover"
            />
            
            {/* Simple category badge */}
            <div className="absolute top-3 left-3">
              <Tag className="rounded-md border-0 bg-white/90 text-gray-700 font-medium">
                {CATEGORY_EMOJIS[sweet.category]} {sweet.category.replace('_', ' ')}
              </Tag>
            </div>

            {/* Price tag */}
            <div className="absolute bottom-3 right-3">
              <div className="bg-white rounded-md px-3 py-1 shadow-sm">
                <span className="font-semibold text-lg">₹{sweet.price}</span>
              </div>
            </div>

            {/* Stock status */}
            {isOutOfStock && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Tag color="red" className="text-sm font-medium">
                  Out of Stock
                </Tag>
              </div>
            )}
          </div>
        }
        actions={[
          isAdmin ? (
            <Button
              key="edit"
              type="text"
              icon={<EditOutlined />}
              onClick={() => navigate(`/admin/sweets/edit/${sweet.id}`)}
              className="text-blue-600"
            >
              Edit
            </Button>
          ) : (
            <Button
              key="purchase"
              type="text"
              icon={<ShoppingCartOutlined />}
              disabled={isOutOfStock}
              onClick={() => handleOpenPurchaseModal(sweet)}
              className="text-green-600"
            >
              {isOutOfStock ? 'Unavailable' : 'Buy Now'}
            </Button>
          )
        ]}
      >
        <div className="p-1">
          <Title level={5} className="mb-2 text-gray-800">
            {sweet.name}
          </Title>
          <Text type="secondary" className="text-sm block mb-3">
            {sweet.description || 'Delicious sweet treat'}
          </Text>
          
          {sweet.inventory && (
            <div className="flex justify-between items-center text-xs text-gray-500">
              <span>Stock: {sweet.inventory.quantity}</span>
              <div className={`w-2 h-2 rounded-full ${
                isOutOfStock ? 'bg-red-400' : isLowStock ? 'bg-orange-400' : 'bg-green-400'
              }`} />
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Clean header [web:27][web:34] */}
      <div className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex justify-between items-center py-4">
            {/* Simple logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-lg">🍬</span>
              </div>
              <div>
                <Title level={4} className="m-0 text-gray-900">Sweet Shop</Title>
                <Text type="secondary" className="text-sm">Premium Confectionery</Text>
              </div>
            </div>

            {/* User menu */}
            <Dropdown menu={{ items: userMenuItems }} trigger={['click']}>
              <Button type="text" className="flex items-center space-x-2">
                <Avatar size="small" icon={<UserOutlined />} className="bg-purple-600" />
                <span className="hidden sm:inline">{user?.name}</span>
                <DownOutlined />
              </Button>
            </Dropdown>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Admin actions - simplified [web:24] */}
        {isAdmin && (
          <div className="mb-8">
            <Card className="bg-purple-600 border-0 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <Title level={4} className="text-white m-0">Admin Panel</Title>
                  <Text className="text-purple-100">Manage your sweet shop</Text>
                </div>
                <Space>
                  <Button 
                    icon={<PlusOutlined />}
                    onClick={() => navigate('/admin/sweets/create')}
                    className="bg-white text-purple-600 border-0"
                  >
                    Add Sweet
                  </Button>
                </Space>
              </div>
            </Card>
          </div>
        )}

        {/* Clean search and filters [web:26] */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1">
              <Input.Search
                placeholder="Search sweets..."
                size="large"
                onSearch={handleSearch}
                onChange={(e) => !e.target.value && handleSearch('')}
                className="rounded-lg"
              />
            </div>
            
            <Select
              placeholder="Category"
              size="large"
              className="sm:w-48"
              allowClear
              value={selectedCategory}
              onChange={handleCategoryChange}
            >
              {SWEET_CATEGORIES.map(category => (
                <Option key={category} value={category}>
                  {CATEGORY_EMOJIS[category]} {category.replace('_', ' ')}
                </Option>
              ))}
            </Select>

            <Button.Group size="large">
              <Button
                type={viewMode === 'grid' ? 'primary' : 'default'}
                icon={<AppstoreOutlined />}
                onClick={() => setViewMode('grid')}
              />
              <Button
                type={viewMode === 'list' ? 'primary' : 'default'}
                icon={<BarsOutlined />}
                onClick={() => setViewMode('list')}
              />
            </Button.Group>
          </div>

          {/* Active filters */}
          {(searchTerm || selectedCategory) && (
            <div className="flex gap-2 mb-4">
              {searchTerm && (
                <Tag closable onClose={() => handleSearch('')}>
                  Search: "{searchTerm}"
                </Tag>
              )}
              {selectedCategory && (
                <Tag closable onClose={() => handleCategoryChange(undefined)}>
                  {CATEGORY_EMOJIS[selectedCategory]} {selectedCategory.replace('_', ' ')}
                </Tag>
              )}
            </div>
          )}
        </div>

        {/* Content area [web:34] */}
        <div className="mb-8">
          {loading ? (
            <div className="flex justify-center py-20">
              <Spin size="large" />
            </div>
          ) : sweets.length > 0 ? (
            <Row gutter={[24, 24]}>
              {sweets.map(sweet => (
                <Col
                  key={sweet.id}
                  xs={24}
                  sm={12}
                  md={viewMode === 'grid' ? 8 : 24}
                  lg={viewMode === 'grid' ? 6 : 24}
                >
                  {renderSweetCard(sweet)}
                </Col>
              ))}
            </Row>
          ) : (
            <Empty
              description="No sweets found"
              className="py-20"
            >
              {isAdmin && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => navigate('/admin/sweets/create')}
                >
                  Add Sweet
                </Button>
              )}
            </Empty>
          )}
        </div>

        {/* Simple pagination */}
        {totalSweets > 0 && (
          <div className="flex justify-center">
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={totalSweets}
              onChange={handlePageChange}
              showSizeChanger={false}
              showQuickJumper={false}
            />
          </div>
        )}
      </div>

      {/* Clean purchase modal [web:24] */}
      <Modal
        title="Purchase Sweet"
        open={purchaseModalVisible}
        onCancel={handleClosePurchaseModal}
        footer={null}
        width={400}
      >
        {selectedSweet && (
          <div className="space-y-6">
            {/* Sweet preview */}
            <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
              <img
                src={selectedSweet.imageUrl || '/api/placeholder/60/60'}
                alt={selectedSweet.name}
                className="w-16 h-16 object-cover rounded-lg"
              />
              <div className="flex-1">
                <div className="font-medium">{selectedSweet.name}</div>
                <div className="text-sm text-gray-500 mb-1">
                  {selectedSweet.description || 'Delicious sweet treat'}
                </div>
                <div className="font-semibold text-lg">₹{selectedSweet.price}</div>
              </div>
            </div>

            {/* Purchase form */}
            <Form
              form={purchaseForm}
              onFinish={handlePurchase}
              layout="vertical"
            >
              <Form.Item
                name="quantity"
                label="Quantity"
                rules={[
                  { required: true, message: 'Please enter quantity' },
                  { type: 'number', min: 1, message: 'Minimum quantity is 1' },
                  { 
                    type: 'number', 
                    max: selectedSweet.inventory?.quantity || 100, 
                    message: `Only ${selectedSweet.inventory?.quantity || 100} available` 
                  }
                ]}
              >
                <InputNumber
                  min={1}
                  max={selectedSweet.inventory?.quantity || 100}
                  className="w-full"
                  placeholder="Enter quantity"
                />
              </Form.Item>

              {/* Total calculation */}
              <Form.Item shouldUpdate>
                {({ getFieldValue }) => {
                  const quantity = getFieldValue('quantity') || 1;
                  const total = quantity * selectedSweet.price;
                  return (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span>Total Amount:</span>
                        <span className="text-xl font-semibold">₹{total.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                }}
              </Form.Item>

              {/* Actions */}
              <div className="flex justify-end space-x-3">
                <Button onClick={handleClosePurchaseModal}>
                  Cancel
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={purchaseLoading}
                  icon={<ShoppingCartOutlined />}
                >
                  Purchase
                </Button>
              </div>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Sweets;
