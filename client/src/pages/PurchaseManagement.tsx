import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Button,
  Input,
  Select,
  DatePicker,
  Tag,
  Space,
  Typography,
  Row,
  Col,
  Statistic,
  Modal,
  message,
  Avatar,
  Tooltip,
  Badge,
  Drawer
} from 'antd';
import {
  SearchOutlined,
  FilterOutlined,
  EyeOutlined,
  EditOutlined,
  ExportOutlined,
  ReloadOutlined,
  ShoppingCartOutlined,
  DollarOutlined,
  UserOutlined,
  CalendarOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/context/AuthContext';
import { usePurchaseService } from '../services/purchaseService';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface Purchase {
  id: string;
  orderNumber: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'RETURNED';
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  sweet: {
    id: string;
    name: string;
    category: string;
    imageUrl?: string;
  };
}

const PurchaseManagement: React.FC = () => {
  const { user } = useAuth();
  const { getAllPurchases, updatePurchaseStatus, getPurchaseStats } = usePurchaseService();
  const navigate = useNavigate();

  // State management
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    status: undefined as string | undefined,
    userId: undefined as string | undefined,
    dateRange: undefined as [dayjs.Dayjs, dayjs.Dayjs] | undefined
  });
  const [stats, setStats] = useState<any>({});
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);

  // Check if user is admin
  if (user?.role !== 'ADMIN') {
    navigate('/dashboard');
    return null;
  }

  // Fetch purchases data
  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        status: filters.status,
        userId: filters.userId,
        startDate: filters.dateRange?.[0]?.toISOString(),
        endDate: filters.dateRange?.[1]?.toISOString()
      };

      const response = await getAllPurchases(params);
      if (response.success) {
        setPurchases(response.data.purchases);
        setPagination(prev => ({
          ...prev,
          total: response.data.totalPurchases
        }));
      }
    } catch (error) {
      console.error('Failed to fetch purchases:', error);
      message.error('Failed to load purchases');
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const response = await getPurchaseStats(30);
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, [pagination.current, pagination.pageSize, filters]);

  useEffect(() => {
    fetchStats();
  }, []);

  // Handle status update
  const handleStatusUpdate = async (purchaseId: string, newStatus: string) => {
    try {
      await updatePurchaseStatus(purchaseId, newStatus);
      message.success('Purchase status updated successfully');
      fetchPurchases();
      fetchStats();
    } catch (error) {
      message.error('Failed to update purchase status');
    }
  };

  // Status color mapping
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'orange';
      case 'COMPLETED': return 'green';
      case 'CANCELLED': return 'red';
      case 'RETURNED': return 'purple';
      default: return 'default';
    }
  };

  // Status icon mapping
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <ClockCircleOutlined />;
      case 'COMPLETED': return <CheckCircleOutlined />;
      case 'CANCELLED': return <CloseCircleOutlined />;
      case 'RETURNED': return <ReloadOutlined />;
      default: return null;
    }
  };

  // Table columns
  const columns: ColumnsType<Purchase> = [
    {
      title: 'Order Details',
      key: 'orderDetails',
      render: (_, record) => (
        <div className="flex items-center space-x-3">
          <Avatar
            src={record.sweet.imageUrl}
            size={48}
            className="flex-shrink-0"
            style={{ backgroundColor: '#f0f0f0' }}
          >
            🍬
          </Avatar>
          <div className="min-w-0 flex-1">
            <Text strong className="block truncate">{record.orderNumber}</Text>
            <Text type="secondary" className="block text-sm truncate">
              {record.sweet.name}
            </Text>
            <Tag size="small" color="purple">
              {record.sweet.category}
            </Tag>
          </div>
        </div>
      ),
      width: 250
    },
    {
      title: 'Customer',
      key: 'customer',
      render: (_, record) => (
        <div>
          <Text strong className="block">{record.user.name}</Text>
          <Text type="secondary" className="text-sm">{record.user.email}</Text>
        </div>
      ),
      width: 200
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (quantity) => (
        <Badge count={quantity} showZero color="#52c41a" />
      ),
      width: 100
    },
    {
      title: 'Amount',
      key: 'amount',
      render: (_, record) => (
        <div className="text-right">
          <Text strong className="block text-lg">${record.totalAmount.toFixed(2)}</Text>
          <Text type="secondary" className="text-sm">
            ${record.unitPrice.toFixed(2)} each
          </Text>
        </div>
      ),
      width: 120
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)} icon={getStatusIcon(status)}>
          {status}
        </Tag>
      ),
      width: 120
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => (
        <div>
          <Text className="block">{dayjs(date).format('MMM D, YYYY')}</Text>
          <Text type="secondary" className="text-sm">
            {dayjs(date).format('h:mm A')}
          </Text>
        </div>
      ),
      width: 120
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedPurchase(record);
                setDetailsVisible(true);
              }}
              className="text-blue-600 hover:bg-blue-50"
            />
          </Tooltip>
          {record.status === 'PENDING' && (
            <Select
              placeholder="Update Status"
              style={{ width: 120 }}
              size="small"
              onChange={(value) => handleStatusUpdate(record.id, value)}
            >
              <Option value="COMPLETED">Complete</Option>
              <Option value="CANCELLED">Cancel</Option>
            </Select>
          )}
        </Space>
      ),
      width: 150
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
       
          
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full mb-4 shadow-lg">
              <ShoppingCartOutlined className="text-2xl text-white" />
            </div>
            <Title level={2} className="mb-2 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Purchase Management
            </Title>
            <Text type="secondary" className="text-lg">
              Monitor and manage all customer purchases
            </Text>
          </div>
        </div>

        {/* Statistics Cards */}
        <Row gutter={[16, 16]} className="mb-8">
          <Col xs={12} sm={6}>
            <Card className="text-center rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
              <Statistic
                title="Total Orders"
                value={stats.summary?.totalOrders || 0}
                prefix={<ShoppingCartOutlined className="text-blue-500" />}
                valueStyle={{ color: '#3b82f6', fontSize: '1.5rem' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="text-center rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
              <Statistic
                title="Total Revenue"
                value={stats.summary?.totalRevenue || 0}
                prefix={<DollarOutlined className="text-green-500" />}
                precision={2}
                valueStyle={{ color: '#10b981', fontSize: '1.5rem' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="text-center rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
              <Statistic
                title="Items Sold"
                value={stats.summary?.totalItemsSold || 0}
                prefix="📦"
                valueStyle={{ color: '#8b5cf6', fontSize: '1.5rem' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="text-center rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
              <Statistic
                title="Avg Order Value"
                value={stats.summary?.averageOrderValue || 0}
                prefix="💰"
                precision={2}
                valueStyle={{ color: '#f59e0b', fontSize: '1.5rem' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Card className="mb-6 rounded-2xl shadow-lg">
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={12} lg={6}>
              <Input.Search
                placeholder="Search orders..."
                allowClear
                onSearch={(value) => setFilters(prev => ({ ...prev, search: value }))}
                className="rounded-xl"
              />
            </Col>
            <Col xs={24} sm={12} lg={4}>
              <Select
                placeholder="Status"
                allowClear
                className="w-full"
                value={filters.status}
                onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
              >
                <Option value="PENDING">Pending</Option>
                <Option value="COMPLETED">Completed</Option>
                <Option value="CANCELLED">Cancelled</Option>
                <Option value="RETURNED">Returned</Option>
              </Select>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <RangePicker
                className="w-full rounded-xl"
                value={filters.dateRange}
                onChange={(dates) => setFilters(prev => ({ ...prev, dateRange: dates as [dayjs.Dayjs, dayjs.Dayjs] }))}
              />
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Space>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    setFilters({
                      search: '',
                      status: undefined,
                      userId: undefined,
                      dateRange: undefined
                    });
                    fetchPurchases();
                  }}
                  className="rounded-xl"
                >
                  Reset
                </Button>
                <Button
                  icon={<ExportOutlined />}
                  type="primary"
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 border-0 rounded-xl"
                >
                  Export
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Purchases Table */}
        <Card className="rounded-2xl shadow-lg">
          <Table
            columns={columns}
            dataSource={purchases}
            rowKey="id"
            loading={loading}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} of ${total} purchases`,
              onChange: (page, size) => setPagination(prev => ({ ...prev, current: page, pageSize: size || 10 }))
            }}
            scroll={{ x: 1200 }}
            className="rounded-xl"
          />
        </Card>

        {/* Purchase Details Drawer */}
        <Drawer
          title="Purchase Details"
          placement="right"
          width={480}
          onClose={() => setDetailsVisible(false)}
          open={detailsVisible}
          className="rounded-l-2xl"
        >
          {selectedPurchase && (
            <div className="space-y-6">
              {/* Order Info */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6">
                <div className="flex items-center space-x-4 mb-4">
                  <Avatar
                    src={selectedPurchase.sweet.imageUrl}
                    size={64}
                    style={{ backgroundColor: '#f0f0f0' }}
                  >
                    🍬
                  </Avatar>
                  <div>
                    <Title level={4} className="m-0">{selectedPurchase.orderNumber}</Title>
                    <Text type="secondary">{selectedPurchase.sweet.name}</Text>
                  </div>
                </div>
                <Tag color={getStatusColor(selectedPurchase.status)} icon={getStatusIcon(selectedPurchase.status)} className="mb-4">
                  {selectedPurchase.status}
                </Tag>
              </div>

              {/* Customer Info */}
              <Card title="Customer Information" className="rounded-xl">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Text type="secondary">Name:</Text>
                    <Text strong>{selectedPurchase.user.name}</Text>
                  </div>
                  <div className="flex justify-between">
                    <Text type="secondary">Email:</Text>
                    <Text>{selectedPurchase.user.email}</Text>
                  </div>
                </div>
              </Card>

              {/* Order Details */}
              <Card title="Order Details" className="rounded-xl">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Text type="secondary">Sweet:</Text>
                    <Text strong>{selectedPurchase.sweet.name}</Text>
                  </div>
                  <div className="flex justify-between">
                    <Text type="secondary">Category:</Text>
                    <Tag color="purple">{selectedPurchase.sweet.category}</Tag>
                  </div>
                  <div className="flex justify-between">
                    <Text type="secondary">Quantity:</Text>
                    <Badge count={selectedPurchase.quantity} showZero color="#52c41a" />
                  </div>
                  <div className="flex justify-between">
                    <Text type="secondary">Unit Price:</Text>
                    <Text>${selectedPurchase.unitPrice.toFixed(2)}</Text>
                  </div>
                  <div className="flex justify-between">
                    <Text type="secondary">Total Amount:</Text>
                    <Text strong className="text-lg text-green-600">
                      ${selectedPurchase.totalAmount.toFixed(2)}
                    </Text>
                  </div>
                </div>
              </Card>

              {/* Timestamps */}
              <Card title="Timeline" className="rounded-xl">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Text type="secondary">Order Date:</Text>
                    <Text>{dayjs(selectedPurchase.createdAt).format('MMMM D, YYYY h:mm A')}</Text>
                  </div>
                  <div className="flex justify-between">
                    <Text type="secondary">Last Updated:</Text>
                    <Text>{dayjs(selectedPurchase.updatedAt).format('MMMM D, YYYY h:mm A')}</Text>
                  </div>
                </div>
              </Card>

              {/* Actions */}
              {selectedPurchase.status === 'PENDING' && (
                <div className="space-y-3">
                  <Button
                    type="primary"
                    block
                    size="large"
                    className="bg-green-500 border-green-500 rounded-xl"
                    onClick={() => {
                      handleStatusUpdate(selectedPurchase.id, 'COMPLETED');
                      setDetailsVisible(false);
                    }}
                  >
                    Mark as Completed
                  </Button>
                  <Button
                    danger
                    block
                    size="large"
                    className="rounded-xl"
                    onClick={() => {
                      handleStatusUpdate(selectedPurchase.id, 'CANCELLED');
                      setDetailsVisible(false);
                    }}
                  >
                    Cancel Order
                  </Button>
                </div>
              )}
            </div>
          )}
        </Drawer>
      </div>
    </div>
  );
};

export default PurchaseManagement;
