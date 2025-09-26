import request from 'supertest';
import app from '../../index'
import { prisma } from '../../config/db.config';
import { SweetCategory, StockMovementType, PurchaseStatus } from '@prisma/client';

describe('Purchase → Inventory Integration', () => {
  let userToken: string;
  let userId: string;
  let sweetId: string;

  beforeAll(async () => {
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'integration@test.com',
        password: 'password123',
        name: 'Integration User'
      });
    
    userToken = userResponse.body.data.token;
    userId = userResponse.body.data.user.id;
  });

  beforeEach(async () => {
    await prisma.purchase.deleteMany();
    await prisma.stockMovement.deleteMany();
    await prisma.inventory.deleteMany();
    await prisma.sweet.deleteMany();

    const sweet = await prisma.sweet.create({
      data: {
        name: 'Integration Test Sweet',
        category: SweetCategory.CHOCOLATES,
        price: 12.99,
        inventory: {
          create: { quantity: 50 }
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

  it('should handle complete purchase → inventory flow', async () => {
    // 1. Create purchase
    const purchaseResponse = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ sweetId, quantity: 5 })
      .expect(201);

    const purchaseId = purchaseResponse.body.data.id;

    // 2. Verify inventory decreased
    const inventory1 = await prisma.inventory.findFirst({
      where: { sweetId }
    });
    expect(inventory1?.quantity).toBe(45); // 50 - 5

    // 3. Cancel purchase
    await request(app)
      .put(`/api/purchases/${purchaseId}/cancel`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    // 4. Verify inventory restored
    const inventory2 = await prisma.inventory.findFirst({
      where: { sweetId }
    });
    expect(inventory2?.quantity).toBe(50) 

    // 5. Verify purchase status
    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId }
    });
    expect(purchase?.status).toBe(PurchaseStatus.CANCELLED);
  });
});
