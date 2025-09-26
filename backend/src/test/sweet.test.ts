import request from 'supertest';
import app from '../index'
import { prisma } from '../config/db.config';
import bcrypt from 'bcrypt';
import { UserRole, SweetCategory } from '@prisma/client';

describe('Sweet Controller', () => {
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 12);
    const admin = await prisma.user.create({
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

    // Create regular user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'user@sweetshop.com',
        password: 'password123',
        name: 'Regular User'
      });
    userToken = userResponse.body.data.token;
  });

  beforeEach(async () => {
    // Clean database
    await prisma.stockMovement.deleteMany();
    await prisma.inventory.deleteMany();
    await prisma.sweet.deleteMany();
  });

  afterAll(async () => {
    await prisma.stockMovement.deleteMany();
    await prisma.inventory.deleteMany();
    await prisma.sweet.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  describe('POST /api/sweets - Create Sweet', () => {
    it('should create a new sweet with inventory (Admin)', async () => {
      const sweetData = {
        name: 'Chocolate Delight',
        description: 'Rich dark chocolate cake',
        category: SweetCategory.CAKES,
        price: 25.99,
        imageUrl: 'https://example.com/chocolate.jpg',
        quantity: 15
      };

      const response = await request(app)
        .post('/api/sweets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(sweetData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Sweet created successfully'
      });

      const sweet = response.body.data;
      expect(sweet.name).toBe(sweetData.name);
      expect(sweet.category).toBe(sweetData.category);
      expect(parseFloat(sweet.price)).toBe(sweetData.price);
      expect(sweet.inventory.quantity).toBe(sweetData.quantity);
    });

    it('should fail for non-admin user', async () => {
      const sweetData = {
        name: 'Test Sweet',
        category: SweetCategory.CANDIES,
        price: 5.99,
        quantity: 10
      };

      await request(app)
        .post('/api/sweets')
        .set('Authorization', `Bearer ${userToken}`)
        .send(sweetData)
        .expect(403);
    });

    it('should fail with invalid data', async () => {
      const invalidData = {
        name: '',
        category: 'INVALID_CATEGORY',
        price: -5
      };

      await request(app)
        .post('/api/sweets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData)
        .expect(400);
    });

    it('should fail for duplicate sweet name', async () => {
      const sweetData = {
        name: 'Duplicate Sweet',
        category: SweetCategory.COOKIES,
        price: 12.99,
        quantity: 20
      };

      // First creation
      await request(app)
        .post('/api/sweets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(sweetData)
        .expect(201);

      // Duplicate creation
      await request(app)
        .post('/api/sweets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(sweetData)
        .expect(409);
    });
  });

  describe('GET /api/sweets - Get Sweets', () => {
    beforeEach(async () => {
      // Create test sweets
      await prisma.sweet.createMany({
        data: [
          {
            name: 'Vanilla Cake',
            category: SweetCategory.CAKES,
            price: 20.99
          },
          {
            name: 'Chocolate Cookies',
            category: SweetCategory.COOKIES,
            price: 8.99
          },
          {
            name: 'Gummy Bears',
            category: SweetCategory.GUMMIES,
            price: 5.99
          }
        ]
      });
    });

    it('should return all sweets with pagination', async () => {
      const response = await request(app)
        .get('/api/sweets')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Sweets retrieved successfully'
      });

      const data = response.body.data;
      expect(data.sweets).toHaveLength(3);
      expect(data.totalSweets).toBe(3);
      expect(data.currentPage).toBe(1);
    });

    it('should filter sweets by category', async () => {
      const response = await request(app)
        .get('/api/sweets')
        .query({ category: SweetCategory.CAKES })
        .expect(200);

      const sweets = response.body.data.sweets;
      expect(sweets).toHaveLength(1);
      expect(sweets[0].category).toBe(SweetCategory.CAKES);
    });

    it('should search sweets by name', async () => {
      const response = await request(app)
        .get('/api/sweets')
        .query({ search: 'chocolate' })
        .expect(200);

      const sweets = response.body.data.sweets;
      expect(sweets).toHaveLength(1);
      expect(sweets[0].name.toLowerCase()).toContain('chocolate');
    });
  });

  describe('PUT /api/sweets/:id - Update Sweet', () => {
    let sweetId: string;

    beforeEach(async () => {
      const sweet = await prisma.sweet.create({
        data: {
          name: 'Test Sweet',
          category: SweetCategory.CANDIES,
          price: 10.99
        }
      });
      sweetId = sweet.id;
    });

    it('should update sweet (Admin)', async () => {
      const updateData = {
        sweetId,
        name: 'Updated Sweet',
        price: 15.99
      };

      const response = await request(app)
        .put(`/api/sweets/${sweetId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Sweet updated successfully'
      });

      const sweet = response.body.data;
      expect(sweet.name).toBe(updateData.name);
      expect(parseFloat(sweet.price)).toBe(updateData.price);
    });

    it('should fail for non-admin user', async () => {
      await request(app)
        .put(`/api/sweets/${sweetId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ sweetId, name: 'Updated' })
        .expect(403);
    });
  });

  describe('DELETE /api/sweets/:id - Delete Sweet', () => {
    let sweetId: string;

    beforeEach(async () => {
      const sweet = await prisma.sweet.create({
        data: {
          name: 'Sweet to Delete',
          category: SweetCategory.CHOCOLATES,
          price: 12.99,
          inventory: {
            create: { quantity: 5 }
          }
        }
      });
      sweetId = sweet.id;
    });

    it('should delete sweet and inventory (Admin)', async () => {
      const response = await request(app)
        .delete(`/api/sweets/${sweetId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Sweet deleted successfully'
      });

      // Verify deletion
      const deletedSweet = await prisma.sweet.findUnique({
        where: { id: sweetId }
      });
      expect(deletedSweet).toBeNull();
    });
  });
});
