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
  Form,
  InputNumber,
  message,
  Avatar,
  Tooltip,
  Alert
} from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  ReloadOutlined,
  ExportOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  WarningOutlined,
  ArrowLeftOutlined,
  ShopOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/context/AuthContext';
import { useStockMovementService } from '../services/stockMovementService';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import RestockModal from '../components/RestockModal';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;
const { TextArea } = Input;

interface StockMovement {
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

interface InventoryItem {
  id: string;
  quantity: number;
  minStockLevel: number;
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

const StockMovement: React.FC = () => {
  const { user } = useAuth();
  const { 
    getStockMovements, 
    getInventoryStatus, 
    getLowStockItems, 
    restockSweet 
  } = useStockMovementService();
  const navigate = useNavigate();

  // State management
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [inventoryStats, setInventoryStats] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [restockModalVisible, setRestockModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [restockForm] = Form.useForm();
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    sweetId: undefined as string | undefined,
    type: undefined as string | undefined,
    dateRange: undefined as [dayjs.Dayjs, dayjs.Dayjs] | undefined
  });

  // Check if user is admin
  if (user?.role !== 'ADMIN') {
    navigate('/dashboard');
    return null;
  }

  // Fetch stock movements
  const fetchMovements = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        sweetId: filters.sweetId,
        type: filters.type,
        startDate: filters.dateRange?.[0]?.toISOString(),
        endDate: filters.dateRange?.[1]?.toISOString()
      };

      const response = await getStockMovements(params);
      if (response.success) {
        setMovements(response.data.movements);
        setPagination(prev => ({
          ...prev,
          total: response.data.totalMovements
        }));
      }
    } catch (error) {
      console.error('Failed to fetch movements:', error);
      message.error('Failed to load stock movements');
    } finally {
      setLoading(false);
    }
  };

  // Fetch inventory status
  const fetchInventoryStatus = async () => {
    try {
      const [statusResponse, lowStockResponse] = await Promise.all([
        getInventoryStatus(),
        getLowStockItems()
      ]);

      if (statusResponse.success) {
        setInventoryStats(statusResponse.data.stats);
      }

      if (lowStockResponse.success) {
        setLowStockItems(lowStockResponse.data);
      }
    } catch (error) {
      console.error('Failed to fetch inventory data:', error);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, [pagination.current, pagination.pageSize, filters]);

  useEffect(() => {
    fetchInventoryStatus();
  }, []);

  // Handle restock
  const handleRestock = async (values: { quantity: number; reason?: string }) => {
    if (!selectedItem) return;

    try {
      await restockSweet(selectedItem.sweet.id, values);
      message.success('Stock restocked successfully! 📦');
      setRestockModalVisible(false);
      restockForm.resetFields();
      setSelectedItem(null);
      fetchMovements();
      fetchInventoryStatus();
    } catch (error) {
      message.error('Failed to restock item');
    }
  };

  // Movement type color and icon
  const getMovementDisplay = (type: string, quantity: number) => {
    if (type === 'RESTOCK') {
      return {
        color: 'green',
        icon: <ArrowUpOutlined />,
        text: `+${quantity}`
      };
    } else {
      return {
        color: 'blue',
        icon: <ArrowDownOutlined />,
        text: `+${quantity}` // Returns are positive additions back to stock
      };
    }
  };

  // Stock status indicator
  const getStockStatus = (item: InventoryItem) => {
    if (item.quantity === 0) {
      return { color: 'red', text: 'Out of Stock', icon: '❌' };
    } else if (item.quantity <= item.reorderPoint) {
      return { color: 'orange', text: 'Low Stock', icon: '⚠️' };
    } else {
      return { color: 'green', text: 'In Stock', icon: '✅' };
    }
  };

  // Table columns for movements
  const movementColumns: ColumnsType<StockMovement> = [
    {
      title: 'Sweet',
      key: 'sweet',
      render: (_, record) => (
        <div className="flex items-center space-x-3">
          <Avatar
            src={record.inventory.sweet.imageUrl}
            size={48}
            style={{ backgroundColor: '#f0f0f0' }}
          >
            🍬
          </Avatar>
          <div>
            <Text strong className="block">{record.inventory.sweet.name}</Text>
            <Tag size="small" color="purple">
              {record.inventory.sweet.category}
            </Tag>
          </div>
        </div>
      ),
      width: 250
    },
    {
      title: 'Movement Type',
      dataIndex: 'type',
      key: 'type',
      render: (type, record) => {
        const display = getMovementDisplay(type, record.quantity);
        return (
          <Tag color={display.color} icon={display.icon}>
            {type}
          </Tag>
        );
      },
      width: 130
    },
    {
      title: 'Quantity Change',
      key: 'quantityChange',
      render: (_, record) => {
        const display = getMovementDisplay(record.type, record.quantity);
        return (
          <div className="text-center">
            <Text strong className={`text-lg text-${display.color}-600`}>
              {display.text}
            </Text>
            <div className="text-xs text-gray-500">units</div>
          </div>
        );
      },
      width: 120
    },
    {
      title: 'Current Stock',
      key: 'currentStock',
      render: (_, record) => (
        <div className="text-center">
          <Text strong className="text-lg">{record.inventory.quantity}</Text>
          <div className="text-xs text-gray-500">units</div>
        </div>
      ),
      width: 120
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      render: (reason) => (
        <Text type="secondary" className="text-sm">
          {reason || 'No reason provided'}
        </Text>
      ),
      width: 200
    },
    {
      title: 'Reference',
      dataIndex: 'reference',
      key: 'reference',
      render: (reference) => (
        <Text type="secondary" className="text-sm font-mono">
          {reference || '-'}
        </Text>
      ),
      width: 150
    },
    {
      title: 'Date & Time',
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
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-indigo-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/sweets')}
              className="text-green-600 hover:text-green-700 hover:bg-green-50 rounded-xl"
              size="large"
            >
              Back to Sweets
            </Button>
          </div>
          
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-green-500 to-blue-600 rounded-full mb-4 shadow-lg">
              <BarChartOutlined className="text-2xl text-white" />
            </div>
            <Title level={2} className="mb-2 bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              Stock Movement
            </Title>
            <Text type="secondary" className="text-lg">
              Monitor inventory changes and manage stock levels
            </Text>
          </div>
        </div>

        {/* Statistics Cards */}
        <Row gutter={[16, 16]} className="mb-8">
          <Col xs={12} sm={6}>
            <Card className="text-center rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
              <Statistic
                title="Total Items"
                value={inventoryStats.totalItems || 0}
                prefix={<ShopOutlined className="text-blue-500" />}
                valueStyle={{ color: '#3b82f6', fontSize: '1.5rem' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="text-center rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
              <Statistic
                title="Low Stock Items"
                value={inventoryStats.lowStockItems || 0}
                prefix={<WarningOutlined className="text-orange-500" />}
                valueStyle={{ color: '#f97316', fontSize: '1.5rem' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="text-center rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
              <Statistic
                title="Out of Stock"
                value={inventoryStats.outOfStockItems || 0}
                prefix="❌"
                valueStyle={{ color: '#ef4444', fontSize: '1.5rem' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="text-center rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
              <Statistic
                title="Total Quantity"
                value={inventoryStats.totalQuantity || 0}
                prefix="📦"
                valueStyle={{ color: '#10b981', fontSize: '1.5rem' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Low Stock Alert */}
        {lowStockItems.length > 0 && (
          <Alert
            message={`⚠️ ${lowStockItems.length} items need attention`}
            description={
              <div className="mt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {lowStockItems.slice(0, 6).map((item) => {
                    const status = getStockStatus(item);
                    return (
                      <div key={item.id} className="bg-white rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Avatar src={item.sweet.imageUrl} size={40}>🍬</Avatar>
                          <div>
                            <Text strong className="block text-sm">{item.sweet.name}</Text>
                            <Text type="secondary" className="text-xs">
                              Stock: {item.quantity} units
                            </Text>
                          </div>
                        </div>
                        <Button
                          type="primary"
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => {
                            setSelectedItem(item);
                            setRestockModalVisible(true);
                          }}
                          className="bg-green-500 border-green-500 rounded-lg"
                        >
                          Restock
                        </Button>
                      </div>
                    );
                  })}
                </div>
                {lowStockItems.length > 6 && (
                  <Text type="secondary" className="block mt-3 text-center">
                    And {lowStockItems.length - 6} more items...
                  </Text>
                )}
              </div>
            }
            type="warning"
            className="mb-6 rounded-2xl"
            showIcon
          />
        )}

        {/* Filters */}
        <Card className="mb-6 rounded-2xl shadow-lg">
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={8} lg={6}>
              <Select
                placeholder="Filter by type"
                allowClear
                className="w-full"
                value={filters.type}
                onChange={(value) => setFilters(prev => ({ ...prev, type: value }))}
              >
                <Option value="RESTOCK">Restock</Option>
                <Option value="RETURN">Return</Option>
              </Select>
            </Col>
            <Col xs={24} sm={8} lg={8}>
              <RangePicker
                className="w-full rounded-xl"
                value={filters.dateRange}
                onChange={(dates) => setFilters(prev => ({ ...prev, dateRange: dates as [dayjs.Dayjs, dayjs.Dayjs] }))}
              />
            </Col>
            <Col xs={24} sm={8} lg={10}>
              <Space>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    setFilters({
                      sweetId: undefined,
                      type: undefined,
                      dateRange: undefined
                    });
                    fetchMovements();
                  }}
                  className="rounded-xl"
                >
                  Reset
                </Button>
                <Button
                  icon={<ExportOutlined />}
                  type="primary"
                  className="bg-gradient-to-r from-green-500 to-blue-600 border-0 rounded-xl"
                >
                  Export
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Stock Movements Table */}
        <Card title="Stock Movement History" className="rounded-2xl shadow-lg">
          <Table
            columns={movementColumns}
            dataSource={movements}
            rowKey="id"
            loading={loading}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} of ${total} movements`,
              onChange: (page, size) => setPagination(prev => ({ ...prev, current: page, pageSize: size || 10 }))
            }}
            scroll={{ x: 1200 }}
            className="rounded-xl"
          />
        </Card>

        {/* Restock Modal */}
        <Modal
          title={
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <PlusOutlined className="text-green-600" />
              </div>
              <div>
                <div className="font-semibold">Restock Item</div>
                <div className="text-sm text-gray-500">
                  {selectedItem?.sweet.name}
                </div>
              </div>
            </div>
          }
          open={restockModalVisible}
          onCancel={() => {
            setRestockModalVisible(false);
            restockForm.resetFields();
            setSelectedItem(null);
          }}
          footer={null}
          width={500}
          className="rounded-2xl"
        >
          {selectedItem && (
            <Form
              form={restockForm}
              onFinish={handleRestock}
              layout="vertical"
              className="mt-6"
            >
              {/* Current Status */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <Text type="secondary">Current Stock:</Text>
                  <Text strong className="text-lg">{selectedItem.quantity} units</Text>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <Text type="secondary">Reorder Point:</Text>
                  <Text>{selectedItem.reorderPoint} units</Text>
                </div>
                <div className="flex items-center justify-between">
                  <Text type="secondary">Status:</Text>
                  <Tag color={getStockStatus(selectedItem).color}>
                    {getStockStatus(selectedItem).icon} {getStockStatus(selectedItem).text}
                  </Tag>
                </div>
              </div>

              <Form.Item
                name="quantity"
                label="Restock Quantity"
                rules={[
                  { required: true, message: 'Please enter restock quantity!' },
                  { type: 'number', min: 1, message: 'Quantity must be at least 1!' }
                ]}
              >
                <InputNumber
                  placeholder="Enter quantity to add"
                  min={1}
                  max={10000}
                  className="w-full rounded-xl"
                  size="large"
                  suffix="units"
                />
              </Form.Item>

              <Form.Item
                name="reason"
                label="Reason (Optional)"
              >
                <TextArea
                  placeholder="Why are you restocking this item?"
                  rows={3}
                  className="rounded-xl"
                  maxLength={255}
                />
              </Form.Item>

              <div className="flex space-x-3">
                <Button
                  onClick={() => {
                    setRestockModalVisible(false);
                    restockForm.resetFields();
                    setSelectedItem(null);
                  }}
                  className="flex-1 rounded-xl"
                  size="large"
                >
                  Cancel
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  className="flex-1 bg-green-500 border-green-500 rounded-xl"
                  size="large"
                  icon={<PlusOutlined />}
                >
                  Restock Item
                </Button>
              </div>
            </Form>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default StockMovement;
