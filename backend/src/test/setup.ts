import { PrismaClient } from '@prisma/client';

// Global test setup
beforeAll(async () => {
  // Any global setup needed before all tests
});

afterAll(async () => {
  // Cleanup after all tests
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.TEST_DATABASE_URL,
      },
    },
  });
  
  await prisma.$disconnect();
});

// Clean up database between tests
afterEach(async () => {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.TEST_DATABASE_URL,
      },
    },
  });

  // Clean up all tables in reverse order due to foreign keys
  await prisma.purchase.deleteMany();
  await prisma.sweet.deleteMany();
  await prisma.user.deleteMany();
  
  await prisma.$disconnect();
});