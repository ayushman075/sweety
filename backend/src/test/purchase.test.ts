import request from 'supertest';
import app from '../index'
import { prisma } from '../config/db.config';
import { SweetCategory, PurchaseStatus } from '@prisma/client';

describe('Purchase Controller', () => {
  let userToken: string;
  let userId: string;
  let sweetId: string;

  beforeAll(async () => {
    // Create user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'buyer@sweetshop.com',
        password: 'password123',
        name: 'Buyer User'
      });
    
    userToken = userResponse.body.data.token;
    userId = userResponse.body.data.user.id;
  });

  beforeEach(async () => {
    // Clean database
    await prisma.purchase.deleteMany();
    await prisma.stockMovement.deleteMany();
    await prisma.inventory.deleteMany();
    await prisma.sweet.deleteMany();

    // Create test sweet with inventory
    const sweet = await prisma.sweet.create({
      data: {
        name: 'Test Sweet for Purchase',
        category: SweetCategory.CANDIES,
        price: 5.99,
        inventory: {
          create: {
            quantity: 20,
            minStockLevel: 5,
            reorderPoint: 10
          }
        }
      }
    });
    sweetId = sweet.id;
  });

  afterAll(async () => {
    await prisma.purchase.deleteMany();
    await prisma.stockMovement.deleteMany();
    await prisma.inventory.deleteMany();
    await prisma.sweet.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  describe('POST /api/purchases - Create Purchase', () => {
    it('should create a purchase and update inventory', async () => {
      const purchaseData = {
        sweetId,
        quantity: 3
      };

      const response = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${userToken}`)
        .send(purchaseData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Purchase created successfully'
      });

      const purchase = response.body.data;
      expect(purchase.quantity).toBe(3);
      expect(purchase.status).toBe(PurchaseStatus.PENDING);
      expect(purchase.userId).toBe(userId);
      expect(purchase.sweetId).toBe(sweetId);
      expect(parseFloat(purchase.totalAmount)).toBe(5.99 * 3);

      // Verify inventory was updated
      const inventory = await prisma.inventory.findFirst({
        where: { sweetId }
      });
      expect(inventory?.quantity).toBe(17); // 20 - 3
    });

    it('should fail when insufficient stock', async () => {
      const purchaseData = {
        sweetId,
        quantity: 25 // More than available (20)
      };

      const response = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${userToken}`)
        .send(purchaseData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Insufficient stock available'
      });
    });

    it('should fail for invalid sweet ID', async () => {
      const purchaseData = {
        sweetId: 'invalid-sweet-id',
        quantity: 1
      };

      await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${userToken}`)
        .send(purchaseData)
        .expect(404);
    });

    it('should fail without authentication', async () => {
      const purchaseData = {
        sweetId,
        quantity: 1
      };

      await request(app)
        .post('/api/purchases')
        .send(purchaseData)
        .expect(401);
    });
  });

  describe('GET /api/purchases/my-purchases - Get User Purchases', () => {
    beforeEach(async () => {
      // Create test purchases
      const purchases = await prisma.purchase.createMany({
        data: [
          {
            orderNumber: 'ORD-001',
            quantity: 2,
            unitPrice: 5.99,
            totalAmount: 11.98,
            status: PurchaseStatus.COMPLETED,
            userId,
            sweetId
          },
          {
            orderNumber: 'ORD-002',
            quantity: 1,
            unitPrice: 5.99,
            totalAmount: 5.99,
            status: PurchaseStatus.PENDING,
            userId,
            sweetId
          }
        ]
      });
    });

    it('should return user purchases with pagination', async () => {
      const response = await request(app)
        .get('/api/purchases/my-purchases')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'User purchases retrieved successfully'
      });

      const data = response.body.data;
      expect(data.purchases).toHaveLength(2);
      expect(data.totalPurchases).toBe(2);
      expect(data.currentPage).toBe(1);
    });

    it('should filter purchases by status', async () => {
      const response = await request(app)
        .get('/api/purchases/my-purchases')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ status: PurchaseStatus.COMPLETED })
        .expect(200);

      const purchases = response.body.data.purchases;
      expect(purchases).toHaveLength(1);
      expect(purchases[0].status).toBe(PurchaseStatus.COMPLETED);
    });
  });

  describe('PUT /api/purchases/:id/cancel - Cancel Purchase', () => {
    let purchaseId: string;

    beforeEach(async () => {
      // Create purchase
      const purchase = await prisma.purchase.create({
        data: {
          orderNumber: 'ORD-CANCEL-001',
          quantity: 2,
          unitPrice: 5.99,
          totalAmount: 11.98,
          status: PurchaseStatus.PENDING,
          userId,
          sweetId
        }
      });
      purchaseId = purchase.id;

      // Update inventory to reflect the purchase
      await prisma.inventory.update({
        where: { sweetId },
        data: { quantity: 18 } // 20 - 2
      });
    });

    it('should cancel purchase and restore inventory', async () => {
      const response = await request(app)
        .put(`/api/purchases/${purchaseId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Purchase cancelled successfully'
      });

      // Verify purchase status updated
      const purchase = await prisma.purchase.findUnique({
        where: { id: purchaseId }
      });
      expect(purchase?.status).toBe(PurchaseStatus.CANCELLED);

      // Verify inventory restored
      const inventory = await prisma.inventory.findFirst({
        where: { sweetId }
      });
      expect(inventory?.quantity).toBe(20); // 18 + 2 (restored)
    });

    it('should fail to cancel completed purchase', async () => {
      // Update purchase to completed
      await prisma.purchase.update({
        where: { id: purchaseId },
        data: { status: PurchaseStatus.COMPLETED }
      });

      const response = await request(app)
        .put(`/api/purchases/${purchaseId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body.message).toContain('cannot be cancelled');
    });
  });
});
