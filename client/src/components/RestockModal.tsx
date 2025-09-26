import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  InputNumber,
  Input,
  Select,
  Button,
  Avatar,
  Typography,
  Tag,
  Space,
  Alert,
  Divider,
  Row,
  Col,
  Progress,
  Card,
  Statistic,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  TruckOutlined,
  DollarOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { useStockMovementService, stockUtils } from '../services/stockMovementService';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface InventoryItem {
  id: string;
  quantity: number;
  minStockLevel: number;
  maxStockLevel: number;
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

interface RestockModalProps {
  visible: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  onSuccess: () => void;
}

interface RestockFormValues {
  quantity: number;
  reason: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  expectedDate?: string;
  supplier?: string;
  cost?: number;
}

const RestockModal: React.FC<RestockModalProps> = ({
  visible,
  onClose,
  item,
  onSuccess
}) => {
  const [form] = Form.useForm<RestockFormValues>();
  const { restockSweet } = useStockMovementService();
  const [loading, setLoading] = useState(false);
  const [calculatedValues, setCalculatedValues] = useState({
    newQuantity: 0,
    restockCost: 0,
    daysOfStock: 0,
    recommendedQuantity: 0
  });

  // Reset form when modal opens/closes
  useEffect(() => {
    if (visible && item) {
      const recommended = stockUtils.getRecommendedRestockQuantity(
        item.quantity,
        item.minStockLevel,
        item.maxStockLevel
      );
      
      form.setFieldsValue({
        quantity: recommended,
        priority: item.quantity === 0 ? 'URGENT' : item.quantity <= item.reorderPoint ? 'HIGH' : 'NORMAL',
        reason: `Restock for ${item.sweet.name}`
      });

      setCalculatedValues(prev => ({
        ...prev,
        recommendedQuantity: recommended
      }));
    } else {
      form.resetFields();
      setCalculatedValues({
        newQuantity: 0,
        restockCost: 0,
        daysOfStock: 0,
        recommendedQuantity: 0
      });
    }
  }, [visible, item, form]);

  // Calculate values when quantity changes
  const handleQuantityChange = (quantity: number | null) => {
    if (!item || !quantity) return;

    const newQuantity = item.quantity + quantity;
    const restockCost = quantity * item.sweet.price * 0.7; // Assume cost is 70% of selling price
    const daysOfStock = Math.floor(newQuantity / 3); // Assume 3 units sold per day average

    setCalculatedValues({
      newQuantity,
      restockCost,
      daysOfStock,
      recommendedQuantity: calculatedValues.recommendedQuantity
    });
  };

  // Handle form submission
  const handleSubmit = async (values: RestockFormValues) => {
    if (!item) return;

    try {
      setLoading(true);
      await restockSweet(item.sweet.id, {
        quantity: values.quantity,
        reason: values.reason
      });
      
      onSuccess();
      onClose();
      form.resetFields();
    } catch (error) {
      console.error('Restock failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get stock status
  const getStockStatus = (item: InventoryItem) => {
    return stockUtils.getStockStatus(item.quantity, item.reorderPoint, item.maxStockLevel);
  };

  // Priority colors
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'red';
      case 'HIGH': return 'orange';
      case 'NORMAL': return 'blue';
      case 'LOW': return 'green';
      default: return 'default';
    }
  };

  if (!item) return null;

  const status = getStockStatus(item);
  const daysSinceRestock = stockUtils.getDaysSinceRestock(item.lastRestockedAt);

  return (
    <Modal
      title={
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-600 rounded-full flex items-center justify-center">
            <TruckOutlined className="text-white text-lg" />
          </div>
          <div>
            <div className="font-semibold text-lg">Restock Item</div>
            <div className="text-sm text-gray-500 font-normal">
              Add inventory to your sweet shop
            </div>
          </div>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={700}
      className="rounded-2xl"
      destroyOnClose
    >
      <div className="mt-6">
        {/* Item Overview */}
        <Card className="mb-6 bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 rounded-2xl">
          <div className="flex items-center space-x-4">
            <Avatar
              src={item.sweet.imageUrl}
              size={80}
              className="flex-shrink-0"
              style={{ backgroundColor: '#f0f0f0' }}
            >
              🍬
            </Avatar>
            <div className="flex-1 min-w-0">
              <Title level={4} className="m-0 truncate">{item.sweet.name}</Title>
              <div className="flex items-center space-x-3 mt-2">
                <Tag color="purple">{item.sweet.category}</Tag>
                <Tag color={status.color} icon={
                  status.status === 'OUT_OF_STOCK' ? <WarningOutlined /> : 
                  status.status === 'LOW_STOCK' ? <InfoCircleOutlined /> : 
                  <CheckCircleOutlined />
                }>
                  {status.icon} {status.status.replace('_', ' ')}
                </Tag>
                <Text strong className="text-lg text-green-600">
                  ${item.sweet.price.toFixed(2)}
                </Text>
              </div>
            </div>
          </div>
        </Card>

        {/* Current Status Grid */}
        <Row gutter={[16, 16]} className="mb-6">
          <Col xs={12} sm={6}>
            <Card className="text-center rounded-xl" size="small">
              <Statistic
                title="Current Stock"
                value={item.quantity}
                suffix="units"
                valueStyle={{ fontSize: '1.2rem', color: status.color === 'red' ? '#ef4444' : '#10b981' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="text-center rounded-xl" size="small">
              <Statistic
                title="Reorder Point"
                value={item.reorderPoint}
                suffix="units"
                valueStyle={{ fontSize: '1.2rem', color: '#f59e0b' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="text-center rounded-xl" size="small">
              <Statistic
                title="Max Capacity"
                value={item.maxStockLevel}
                suffix="units"
                valueStyle={{ fontSize: '1.2rem', color: '#6366f1' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="text-center rounded-xl" size="small">
              <Statistic
                title="Days Since Restock"
                value={daysSinceRestock || 'N/A'}
                suffix={daysSinceRestock ? 'days' : ''}
                valueStyle={{ 
                  fontSize: '1.2rem', 
                  color: !daysSinceRestock ? '#6b7280' : daysSinceRestock > 30 ? '#ef4444' : '#10b981' 
                }}
              />
            </Card>
          </Col>
        </Row>

        {/* Stock Level Visualization */}
        <Card className="mb-6 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <Text strong>Stock Level</Text>
            <Text type="secondary">{item.quantity} / {item.maxStockLevel} units</Text>
          </div>
          <Progress
            percent={Math.min((item.quantity / item.maxStockLevel) * 100, 100)}
            strokeColor={{
              '0%': item.quantity <= item.reorderPoint ? '#ef4444' : '#10b981',
              '100%': item.quantity <= item.reorderPoint ? '#f97316' : '#059669',
            }}
            trailColor="#f3f4f6"
            className="mb-2"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>Min: {item.minStockLevel}</span>
            <span>Reorder: {item.reorderPoint}</span>
            <span>Max: {item.maxStockLevel}</span>
          </div>
        </Card>

        {/* Alert Messages */}
        {item.quantity === 0 && (
          <Alert
            message="Critical Stock Level"
            description="This item is completely out of stock. Immediate restocking is required to prevent sales loss."
            type="error"
            showIcon
            className="mb-4 rounded-xl"
            icon={<WarningOutlined />}
          />
        )}
        
        {item.quantity <= item.reorderPoint && item.quantity > 0 && (
          <Alert
            message="Low Stock Warning"
            description={`Stock level is below the reorder point of ${item.reorderPoint} units. Consider restocking soon.`}
            type="warning"
            showIcon
            className="mb-4 rounded-xl"
            icon={<InfoCircleOutlined />}
          />
        )}

        <Divider />

        {/* Restock Form */}
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          className="space-y-4"
        >
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="quantity"
                label={
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">Restock Quantity</span>
                    <Tooltip title={`Recommended: ${calculatedValues.recommendedQuantity} units`}>
                      <InfoCircleOutlined className="text-blue-500" />
                    </Tooltip>
                  </div>
                }
                rules={[
                  { required: true, message: 'Please enter restock quantity!' },
                  { type: 'number', min: 1, message: 'Quantity must be at least 1!' },
                  { 
                    type: 'number', 
                    max: item.maxStockLevel - item.quantity, 
                    message: `Cannot exceed maximum capacity (${item.maxStockLevel - item.quantity} units available)!` 
                  }
                ]}
              >
                <InputNumber
                  placeholder="Enter quantity to add"
                  min={1}
                  max={item.maxStockLevel - item.quantity}
                  className="w-full rounded-xl"
                  size="large"
                  suffix="units"
                  onChange={handleQuantityChange}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name="priority"
                label={<span className="font-medium">Priority Level</span>}
                rules={[{ required: true, message: 'Please select priority!' }]}
              >
                <Select
                  placeholder="Select priority"
                  size="large"
                  className="rounded-xl"
                >
                  <Option value="LOW">
                    <Tag color="green">🟢 Low Priority</Tag>
                  </Option>
                  <Option value="NORMAL">
                    <Tag color="blue">🔵 Normal Priority</Tag>
                  </Option>
                  <Option value="HIGH">
                    <Tag color="orange">🟠 High Priority</Tag>
                  </Option>
                  <Option value="URGENT">
                    <Tag color="red">🔴 Urgent</Tag>
                  </Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="reason"
            label={<span className="font-medium">Restock Reason</span>}
            rules={[
              { required: true, message: 'Please provide a reason for restocking!' },
              { max: 255, message: 'Reason must be less than 255 characters!' }
            ]}
          >
            <TextArea
              placeholder="Why are you restocking this item? (e.g., Weekly inventory replenishment, High demand, Seasonal preparation)"
              rows={3}
              className="rounded-xl"
              showCount
              maxLength={255}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="supplier"
                label={<span className="font-medium">Supplier (Optional)</span>}
              >
                <Input
                  placeholder="Supplier name"
                  className="rounded-xl"
                  size="large"
                  prefix={<TruckOutlined className="text-gray-400" />}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name="cost"
                label={<span className="font-medium">Unit Cost (Optional)</span>}
              >
                <InputNumber
                  placeholder="0.00"
                  min={0}
                  precision={2}
                  className="w-full rounded-xl"
                  size="large"
                  prefix={<DollarOutlined className="text-gray-400" />}
                  formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value!.replace(/\$\s?|(,*)/g, '')}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Calculation Preview */}
          {calculatedValues.newQuantity > 0 && (
            <Card className="bg-blue-50 border-blue-200 rounded-xl">
              <Title level={5} className="mb-3 text-blue-800">📊 Restock Preview</Title>
              <Row gutter={[16, 8]}>
                <Col xs={12} sm={6}>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {calculatedValues.newQuantity}
                    </div>
                    <div className="text-xs text-gray-600">New Total Stock</div>
                  </div>
                </Col>
                <Col xs={12} sm={6}>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      ${calculatedValues.restockCost.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-600">Est. Cost</div>
                  </div>
                </Col>
                <Col xs={12} sm={6}>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {calculatedValues.daysOfStock}
                    </div>
                    <div className="text-xs text-gray-600">Days of Stock</div>
                  </div>
                </Col>
                <Col xs={12} sm={6}>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {Math.round((calculatedValues.newQuantity / item.maxStockLevel) * 100)}%
                    </div>
                    <div className="text-xs text-gray-600">Capacity Used</div>
                  </div>
                </Col>
              </Row>
            </Card>
          )}

          <Divider />

          {/* Form Actions */}
          <div className="flex justify-between items-center pt-4">
            <div className="text-sm text-gray-500">
              📅 Restocking will be recorded on {dayjs().format('MMMM D, YYYY')}
            </div>
            <Space size="middle">
              <Button
                onClick={onClose}
                className="rounded-xl px-6"
                size="large"
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                className="bg-gradient-to-r from-green-500 to-blue-600 border-0 rounded-xl px-8"
                size="large"
                icon={<PlusOutlined />}
              >
                {loading ? 'Restocking...' : 'Confirm Restock'}
              </Button>
            </Space>
          </div>
        </Form>
      </div>
    </Modal>
  );
};

export default RestockModal;
