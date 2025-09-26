import React, { useState } from "react";
import {
  Form,
  Input,
  Select,
  InputNumber,
  Button,
  Card,
  Upload,
  message,
  Row,
  Col,
  Typography,
  Space,
  Progress,
} from "antd";
import {
  PlusOutlined,
  UploadOutlined,
  SaveOutlined,
  EyeOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../components/context/AuthContext";
import { useSweetService } from "../services/sweetService";
import type { UploadFile, UploadProps } from "antd/es/upload/interface";

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const SWEET_CATEGORIES = [
  { value: "CHOCOLATES", label: "Chocolates", emoji: "🍫" },
  { value: "CANDIES", label: "Candies", emoji: "🍬" },
  { value: "CAKES", label: "Cakes", emoji: "🎂" },
  { value: "COOKIES", label: "Cookies", emoji: "🍪" },
  { value: "PASTRIES", label: "Pastries", emoji: "🥐" },
  { value: "ICE_CREAM", label: "Ice Cream", emoji: "🍦" },
  { value: "GUMMIES", label: "Gummies", emoji: "🐻" },
  { value: "HARD_CANDIES", label: "Hard Candies", emoji: "🍭" },
  { value: "LOLLIPOPS", label: "Lollipops", emoji: "🍭" },
  { value: "TRUFFLES", label: "Truffles", emoji: "🍫" },
];

interface FormValues {
  name: string;
  description: string;
  category: string;
  price: number;
  quantity: number;
  minStockLevel: number;
  maxStockLevel: number;
  reorderPoint: number;
}

const AddSweet: React.FC = () => {
  const [form] = Form.useForm<FormValues>();
  const { user } = useAuth();
  const { createSweet } = useSweetService();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [previewImage, setPreviewImage] = useState<string>("");
  const [formProgress, setFormProgress] = useState(0);

  if (user?.role !== "ADMIN") {
    navigate("/dashboard");
    return null;
  }

  const handleSubmit = async (values: FormValues) => {
    try {
      setLoading(true);
      const sweetData = {
        ...values,
        image: fileList[0]?.originFileObj as File,
      };
      await createSweet(sweetData);
      message.success("Sweet added successfully! 🍬");
      navigate("/dashboard");
    } catch (error: any) {
      message.error(
        error.response?.data?.message || "Failed to add sweet. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = () => {
    const values = form.getFieldsValue();
    const totalFields = 7;
    let filledFields = 0;
    if (values.name) filledFields++;
    if (values.description) filledFields++;
    if (values.category) filledFields++;
    if (values.price > 0) filledFields++;
    if (values.quantity >= 0) filledFields++;
    if (values.minStockLevel >= 0) filledFields++;
    if (values.reorderPoint >= 0) filledFields++;
    setFormProgress(Math.round((filledFields / totalFields) * 100));
  };

  const uploadProps: UploadProps = {
    fileList,
    onRemove: () => {
      setFileList([]);
      setPreviewImage("");
    },
    beforeUpload: (file) => {
      const isValidType = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
      ].includes(file.type);
      if (!isValidType) {
        message.error("Please upload a valid image file (JPEG, PNG, WebP, or GIF)");
        return false;
      }
      const isValidSize = file.size / 1024 / 1024 < 5;
      if (!isValidSize) {
        message.error("Image must be smaller than 5MB");
        return false;
      }
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      
      // Update file list
      const newFile = {
        uid: file.uid,
        name: file.name,
        status: 'done' as const,
        originFileObj: file,
        url: URL.createObjectURL(file)
      };
      setFileList([newFile]);
      
      return false; // Prevent auto upload
    },
    maxCount: 1,
    showUploadList: false, // We'll handle the preview manually
  };

  const handleQuantityChange = (quantity: number | null) => {
    if (quantity && quantity > 0) {
      form.setFieldsValue({
        minStockLevel: Math.max(5, Math.floor(quantity * 0.1)),
        maxStockLevel: quantity * 5,
        reorderPoint: Math.max(10, Math.floor(quantity * 0.2)),
      });
    }
  };

  const handleRemoveImage = () => {
    setPreviewImage("");
    setFileList([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header - Single line with proper spacing */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center space-x-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full shadow-lg">
              <PlusOutlined className="text-2xl text-white" />
            </div>
            <div className="text-left">
              <Title
                level={2}
                className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-1"
                style={{ margin: 0 }}
              >
                Add New Sweet
              </Title>
              <Text type="secondary" className="text-base">
                Fill in details to add a new item to your sweet shop
              </Text>
            </div>
          </div>
        </div>

        {/* Progress */}
        <Progress
          percent={formProgress}
          strokeColor={{ "0%": "#9333ea", "100%": "#ec4899" }}
          showInfo={false}
          className="h-1"
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          onValuesChange={handleFormChange}
        >
          <Row gutter={[24, 16]} className="mb-6">
            {/* Left Column */}
            <Col xs={24} lg={14}>
              <Card className="rounded-2xl shadow-md">
                <Row gutter={[16, 16]}>
                  <Col span={24}>
                    <Form.Item
                      name="name"
                      label="Sweet Name"
                      rules={[{ required: true, message: "Please enter the name" }]}
                    >
                      <Input size="large" placeholder="Chocolate Fudge..." />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item name="description" label="Description">
                      <TextArea rows={4} maxLength={500} showCount placeholder="Describe your delicious sweet..." />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      name="category"
                      label="Category"
                      rules={[{ required: true, message: "Please select category" }]}
                    >
                      <Select placeholder="Choose category" size="large">
                        {SWEET_CATEGORIES.map((c) => (
                          <Option key={c.value} value={c.value}>
                            {c.emoji} {c.label}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      name="price"
                      label="Price"
                      rules={[{ required: true, message: "Please enter price" }]}
                    >
                      <InputNumber
                        min={1}
                        max={100000}
                        step={1}
                        className="w-full"
                        size="large"
                        placeholder="0.00"
                        formatter={(value) => ` ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={(value) => value!.replace(/\$\s?|(,*)/g, '') as any}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Col>

            {/* Right Column - Image Upload */}
            <Col xs={24} lg={10}>
              <Card className="rounded-2xl shadow-md">
                <Form.Item label="Sweet Image" required>
                  {previewImage ? (
                    <div className="relative">
                      <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center bg-gray-50">
                        <img
                          src={previewImage}
                          alt="Preview"
                          className="w-full h-48 object-cover rounded-lg mx-auto mb-3"
                        />
                        <div className="flex justify-center space-x-3">
                          <Button 
                            icon={<EyeOutlined />} 
                            type="text"
                            onClick={() => window.open(previewImage, '_blank')}
                          >
                            View Full Size
                          </Button>
                          <Button
                            icon={<DeleteOutlined />}
                            type="text"
                            danger
                            onClick={handleRemoveImage}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Upload {...uploadProps}>
                      <div className="border-2 border-dashed border-purple-200 rounded-xl p-8 text-center bg-purple-50/30 hover:bg-purple-50/50 transition-colors cursor-pointer">
                        <div className="flex flex-col h-62 w-72 items-center">
                          <div className="h-28 w-28 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                            <UploadOutlined className="text-2xl text-purple-500" />
                          </div>
                          <p className="text-gray-700 font-medium mb-1">Upload Sweet Image</p>
                          <p className="text-gray-500 text-sm mb-2">Click or drag an image here</p>
                          <p className="text-gray-400 text-xs">JPEG, PNG, WebP, GIF (max 5MB)</p>
                        </div>
                      </div>
                    </Upload>
                  )}
                </Form.Item>
              </Card>
            </Col>
          </Row>

          {/* Inventory Section */}
          <Card className="rounded-2xl shadow-md mt-8">
            <div className="mb-4">
              <Title level={4} className="text-purple-600 mb-1">
                <InfoCircleOutlined className="mr-2" />
                Inventory Management
              </Title>
              <Text type="secondary" className="text-sm">
                Set up stock levels to manage your inventory effectively
              </Text>
            </div>
            
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={6}>
                <Form.Item
                  name="quantity"
                  label="Initial Stock"
                  rules={[{ required: true, message: "Enter initial stock" }]}
                >
                  <InputNumber
                    min={0}
                    max={10000}
                    className="w-full"
                    size="large"
                    onChange={handleQuantityChange}
                    placeholder="100"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Form.Item name="minStockLevel" label="Min Stock Level">
                  <InputNumber 
                    min={0} 
                    className="w-full" 
                    size="large" 
                    placeholder="10"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Form.Item name="maxStockLevel" label="Max Stock Level">
                  <InputNumber 
                    min={1} 
                    className="w-full" 
                    size="large" 
                    placeholder="500"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Form.Item name="reorderPoint" label="Reorder Point">
                  <InputNumber 
                    min={0} 
                    className="w-full" 
                    size="large" 
                    placeholder="20"
                  />
                </Form.Item>
              </Col>
            </Row>
            
            <div className="bg-blue-50 p-3 rounded-lg mt-4">
              <Text type="secondary" className="text-sm">
                💡 <strong>Tip:</strong> Stock levels are auto-calculated based on initial stock. 
                Min stock = 10% of initial, Max stock = 5x initial, Reorder point = 20% of initial.
              </Text>
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end mt-6 pt-4 border-t border-gray-100">
            <Space size="large">
              <Button 
                size="large"
                onClick={() => navigate("/sweets")}
                className="px-8"
              >
                Cancel
              </Button>
              <Button
                type="primary"
                size="large"
                htmlType="submit"
                loading={loading}
                icon={<SaveOutlined />}
                className="bg-gradient-to-r from-purple-500 to-pink-600 border-0 px-8 shadow-lg"
                disabled={formProgress < 80}
              >
                {loading ? "Adding Sweet..." : "Add Sweet"}
              </Button>
            </Space>
          </div>
        </Form>
      </div>
    </div>
  );
};

export default AddSweet;