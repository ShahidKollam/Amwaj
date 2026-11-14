/**
 * Amwaj POS — admin-only seed (no catalog / no demo data)
 *
 * Creates or updates:
 *   - OWNER user (default: admin / amwaj2024)
 *   - Shop settings row if none exists (defaults only)
 *
 * Does NOT create staff, categories, products, or customers.
 *
 * Usage:
 *   cd backend && node prisma/seed-admin.js
 *   cd backend && npm run db:seed:admin
 *
 * Override via env:
 *   SEED_ADMIN_USERNAME  SEED_ADMIN_PASSWORD  SEED_ADMIN_NAME
 *
 * Full demo catalog: npm run db:seed  (prisma/seed.js)
 */
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
    update: { name, passwordHash, role: 'OWNER', isActive: true },
    create: { name, username, passwordHash, role: 'OWNER' },
  });

  console.log('Admin (OWNER) ready:', admin.username);

  const existing = await prisma.shopSettings.findFirst();
  if (!existing) {
    await prisma.shopSettings.create({
      data: {
        shopName: 'Amwaj',
        invoicePrefix: 'AMW',
        nextInvoiceSeq: 1,
      },
    });
    console.log('Shop settings created (defaults)');
  } else {
    console.log('Shop settings already present — left unchanged');
  }

  console.log(`Login: ${username} / ${password}`);
  console.log('No products, categories, staff, or customers were added.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
