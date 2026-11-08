import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME || 'admin';
  const password = process.env.SEED_ADMIN_PASSWORD || 'amwaj2024';
  const name = process.env.SEED_ADMIN_NAME || 'Amwaj Owner';

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { username },
    update: {},
    create: {
      name,
      username,
      passwordHash,
      role: 'OWNER',
    },
  });

  console.log('Seeded admin user:', admin.username);

  // Categories
  const categories = [
    { name: 'Attar', sortOrder: 1 },
    { name: 'Oud', sortOrder: 2 },
    { name: 'Spray', sortOrder: 3 },
    { name: 'Bakhoor', sortOrder: 4 },
    { name: 'Accessories', sortOrder: 5 },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: { sortOrder: cat.sortOrder },
      create: cat,
    });
  }

  const attar = await prisma.category.findUnique({ where: { name: 'Attar' } });
  const oud = await prisma.category.findUnique({ where: { name: 'Oud' } });
  const spray = await prisma.category.findUnique({ where: { name: 'Spray' } });
  const bakhoor = await prisma.category.findUnique({ where: { name: 'Bakhoor' } });
  const accessories = await prisma.category.findUnique({ where: { name: 'Accessories' } });

  // Sample products (prices in paise)
  const products = [
    { name: 'Royal Oud', categoryId: oud.id, productType: 'PER_ML', unitPrice: 10000, unit: 'ml' }, // ₹100/ml
    { name: 'Amber Attar', categoryId: attar.id, productType: 'PER_ML', unitPrice: 9000, unit: 'ml' },
    { name: 'White Oud', categoryId: oud.id, productType: 'PER_ML', unitPrice: 12000, unit: 'ml' },
    { name: 'Oud Spray', categoryId: spray.id, productType: 'SPRAY', unitPrice: 180000, unit: 'piece' }, // base example
    { name: 'Bakhoor Classic', categoryId: bakhoor.id, productType: 'FIXED', unitPrice: 45000, unit: 'packet' },
    { name: 'Premium Bottle 100ml', categoryId: accessories.id, productType: 'FIXED', unitPrice: 25000, unit: 'piece' },
  ];

  for (const p of products) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (!existing) {
      await prisma.product.create({ data: p });
    }
  }

  // Shop settings
  await prisma.shopSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      shopName: 'Amwaj',
      address: 'Your Shop Address',
      phone: '',
      invoicePrefix: 'AMW',
      nextInvoiceSeq: 1,
    },
  }).catch(async () => {
    // if id constraint, just create if none
    const count = await prisma.shopSettings.count();
    if (count === 0) {
      await prisma.shopSettings.create({
        data: {
          shopName: 'Amwaj',
          address: 'Your Shop Address',
          invoicePrefix: 'AMW',
          nextInvoiceSeq: 1,
        },
      });
    }
  });

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
