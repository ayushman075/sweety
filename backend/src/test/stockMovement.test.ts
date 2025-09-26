import request from 'supertest';
import app from '../index'
import { prisma } from '../config/db.config';
import { UserRole, SweetCategory, StockMovementType } from '@prisma/client';
import bcrypt from 'bcrypt';

describe('Stock Movement Controller', () => {
  let adminToken: string;
  let sweetId: string;
  let inventoryId: string;

  beforeAll(async () => {
    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 12);
    await prisma.user.create({
      data: {
        email: 'admin@sweetshop.com',
        password: hashedPassword,
        name: 'Admin User',
        role: UserRole.ADMIN
      }
    });

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@sweetshop.com', password: 'admin123' });
    adminToken = adminLogin.body.data.token;
  });

  beforeEach(async () => {
    // Clean database
    await prisma.stockMovement.deleteMany();
    await prisma.inventory.deleteMany();
    await prisma.sweet.deleteMany();

    // Create test sweet with inventory
    const sweet = await prisma.sweet.create({
      data: {
        name: 'Test Sweet for Stock',
        category: SweetCategory.CANDIES,
        price: 7.99,
        inventory: {
          create: {
            quantity: 10,
            minStockLevel: 5,
            reorderPoint: 8
          }
        }
      },
      include: { inventory: true }
    });
    
    sweetId = sweet.id;
    inventoryId = sweet.inventory!.id;
  });

  afterAll(async () => {
    await prisma.stockMovement.deleteMany();
    await prisma.inventory.deleteMany();
    await prisma.sweet.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  describe('POST /api/inventory/:id/restock - Restock Sweet', () => {
    it('should restock sweet and create stock movement', async () => {
      const restockData = {
        quantity: 20,
        reason: 'Weekly restock delivery'
      };

      const response = await request(app)
        .post(`/api/inventory/${sweetId}/restock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(restockData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Sweet restocked successfully'
      });

      // Verify inventory updated
      const inventory = await prisma.inventory.findUnique({
        where: { id: inventoryId }
      });
      expect(inventory?.quantity).toBe(30); // 10 + 20

      // Verify stock movement created
      const stockMovement = await prisma.stockMovement.findFirst({
        where: { 
          inventoryId,
          type: StockMovementType.RESTOCK
        }
      });
      expect(stockMovement).toBeTruthy();
      expect(stockMovement?.quantity).toBe(20);
      expect(stockMovement?.reason).toBe(restockData.reason);
    });

    it('should update lastRestockedAt timestamp', async () => {
      const beforeRestock = new Date();

      await request(app)
        .post(`/api/inventory/${sweetId}/restock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 10 })
        .expect(200);

      const inventory = await prisma.inventory.findUnique({
        where: { id: inventoryId }
      });

      expect(inventory?.lastRestockedAt).toBeTruthy();
      expect(inventory?.lastRestockedAt!.getTime()).toBeGreaterThan(beforeRestock.getTime());
    });

    it('should fail for non-admin user', async () => {
      // Create regular user
      const userResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'user@sweetshop.com',
          password: 'password123',
          name: 'Regular User'
        });
      
      const userToken = userResponse.body.data.token;

      await request(app)
        .post(`/api/inventory/${sweetId}/restock`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ quantity: 10 })
        .expect(403);
    });
  });

  describe('GET /api/inventory/movements - Get Stock Movements', () => {
    beforeEach(async () => {
      // Create test stock movements
      await prisma.stockMovement.createMany({
        data: [
          {
            type: StockMovementType.RESTOCK,
            quantity: 15,
            reason: 'Initial stock',
            inventoryId
          },
          {
            type: StockMovementType.RESTOCK,
            quantity: 10,
            reason: 'Weekly delivery',
            inventoryId
          }
        ]
      });
    });

    it('should return stock movements with pagination', async () => {
      const response = await request(app)
        .get('/api/inventory/movements')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Stock movements retrieved successfully'
      });

      const data = response.body.data;
      expect(data.movements).toHaveLength(2);
      expect(data.totalMovements).toBe(2);
      expect(data.currentPage).toBe(1);
    });

    it('should filter movements by type', async () => {
      const response = await request(app)
        .get('/api/inventory/movements')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ type: StockMovementType.RESTOCK })
        .expect(200);

      const movements = response.body.data.movements;
      expect(movements).toHaveLength(2);
      movements.forEach((movement: any) => {
        expect(movement.type).toBe(StockMovementType.RESTOCK);
      });
    });
  });

  describe('GET /api/inventory/low-stock - Get Low Stock Items', () => {
    beforeEach(async () => {
      // Create low stock sweet
      await prisma.sweet.create({
        data: {
          name: 'Low Stock Sweet',
          category: SweetCategory.COOKIES,
          price: 3.99,
          inventory: {
            create: {
              quantity: 3, // Below reorder point of 8
              minStockLevel: 5,
              reorderPoint: 8
            }
          }
        }
      });
    });

    it('should return items below reorder point', async () => {
      const response = await request(app)
        .get('/api/inventory/low-stock')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Low stock items retrieved successfully'
      });

      const lowStockItems = response.body.data;
      expect(lowStockItems).toHaveLength(1);
      expect(lowStockItems[0].sweet.name).toBe('Low Stock Sweet');
      expect(lowStockItems[0].quantity).toBe(3);
    });
  });
});
