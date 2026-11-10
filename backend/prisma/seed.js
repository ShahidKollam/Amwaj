/**
 * Amwaj POS — clean seed for testing
 * Creates: OWNER admin, one STAFF, categories, products (with optional purchase rates),
 * customers, shop settings. Does NOT create invoices (you bill live for real reports/P&L).
 *
 * Run after wipe:
 *   npx prisma db push
 *   npm run db:seed
 *   # or: node prisma/seed.js
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
    update: {
      name,
      passwordHash,
      role: 'OWNER',
      isActive: true,
    },
    create: { name, username, passwordHash, role: 'OWNER' },
  });
  console.log('Admin (OWNER):', admin.username, '/ password from SEED_ADMIN_PASSWORD or amwaj2024');

  // Staff for role testing (no P&L, no purchase rate)
  const staffHash = await bcrypt.hash('staff1234', 12);
  const staff = await prisma.user.upsert({
    where: { username: 'staff' },
    update: {
      name: 'Counter Staff',
      passwordHash: staffHash,
      role: 'STAFF',
      isActive: true,
    },
    create: {
      name: 'Counter Staff',
      username: 'staff',
      passwordHash: staffHash,
      role: 'STAFF',
    },
  });
  console.log('Staff (STAFF):', staff.username, '/ staff1234');

  const categoryDefs = [
    { name: 'Attar', sortOrder: 1 },
    { name: 'Oud', sortOrder: 2 },
    { name: 'Spray', sortOrder: 3 },
    { name: 'Bakhoor', sortOrder: 4 },
    { name: 'Accessories', sortOrder: 5 },
  ];
  for (const cat of categoryDefs) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: { sortOrder: cat.sortOrder, isActive: true },
      create: cat,
    });
  }

  const attar = await prisma.category.findUnique({ where: { name: 'Attar' } });
  const oud = await prisma.category.findUnique({ where: { name: 'Oud' } });
  const spray = await prisma.category.findUnique({ where: { name: 'Spray' } });
  const bakhoor = await prisma.category.findUnique({ where: { name: 'Bakhoor' } });
  const accessories = await prisma.category.findUnique({ where: { name: 'Accessories' } });

  // unitPrice / purchasePrice in paise (₹1 = 100). purchasePrice optional (owner P&L).
  // PER_ML = selling per ml; SPRAY/FIXED = per piece/packet.
  const products = [
    // Attar (per ml) — sell / cost
    { name: 'Amber Attar', categoryId: attar.id, productType: 'PER_ML', unitPrice: 9000, purchasePrice: 4500, unit: 'ml' },
    { name: 'Mogra Attar', categoryId: attar.id, productType: 'PER_ML', unitPrice: 8500, purchasePrice: 4200, unit: 'ml' },
    { name: 'Rose Attar', categoryId: attar.id, productType: 'PER_ML', unitPrice: 11000, purchasePrice: 5500, unit: 'ml' },
    { name: 'Jasmine Attar', categoryId: attar.id, productType: 'PER_ML', unitPrice: 9500, purchasePrice: 4800, unit: 'ml' },
    { name: 'Kewra Attar', categoryId: attar.id, productType: 'PER_ML', unitPrice: 8000, purchasePrice: 4000, unit: 'ml' },
    { name: 'Hina Attar', categoryId: attar.id, productType: 'PER_ML', unitPrice: 10000, purchasePrice: 5000, unit: 'ml' },
    { name: 'Shamama Attar', categoryId: attar.id, productType: 'PER_ML', unitPrice: 12000, purchasePrice: 6000, unit: 'ml' },
    { name: 'Motia Attar', categoryId: attar.id, productType: 'PER_ML', unitPrice: 8800, purchasePrice: 4400, unit: 'ml' },
    { name: 'Khus Attar', categoryId: attar.id, productType: 'PER_ML', unitPrice: 9200, purchasePrice: 4600, unit: 'ml' },
    { name: 'Sandal Attar', categoryId: attar.id, productType: 'PER_ML', unitPrice: 15000, purchasePrice: 7500, unit: 'ml' },
    { name: 'White Musk Attar', categoryId: attar.id, productType: 'PER_ML', unitPrice: 10500, purchasePrice: 5200, unit: 'ml' },
    { name: 'Black Musk Attar', categoryId: attar.id, productType: 'PER_ML', unitPrice: 11500, purchasePrice: 5800, unit: 'ml' },

    // Oud (per ml)
    { name: 'Royal Oud', categoryId: oud.id, productType: 'PER_ML', unitPrice: 10000, purchasePrice: 5000, unit: 'ml' },
    { name: 'White Oud', categoryId: oud.id, productType: 'PER_ML', unitPrice: 12000, purchasePrice: 6000, unit: 'ml' },
    { name: 'Hindi Oud', categoryId: oud.id, productType: 'PER_ML', unitPrice: 18000, purchasePrice: 9000, unit: 'ml' },
    { name: 'Cambodi Oud', categoryId: oud.id, productType: 'PER_ML', unitPrice: 22000, purchasePrice: 11000, unit: 'ml' },
    { name: 'Assam Oud', categoryId: oud.id, productType: 'PER_ML', unitPrice: 16000, purchasePrice: 8000, unit: 'ml' },
    { name: 'Thai Oud', categoryId: oud.id, productType: 'PER_ML', unitPrice: 14000, purchasePrice: 7000, unit: 'ml' },
    { name: 'Oud Maliki', categoryId: oud.id, productType: 'PER_ML', unitPrice: 25000, purchasePrice: 12500, unit: 'ml' },
    { name: 'Oud Special', categoryId: oud.id, productType: 'PER_ML', unitPrice: 13000, purchasePrice: 6500, unit: 'ml' },
    { name: 'Burning Oud', categoryId: oud.id, productType: 'PER_ML', unitPrice: 11000, purchasePrice: 5500, unit: 'ml' },
    { name: 'Dehn Al Oud', categoryId: oud.id, productType: 'PER_ML', unitPrice: 30000, purchasePrice: 15000, unit: 'ml' },
    { name: 'Oud Muattar', categoryId: oud.id, productType: 'PER_ML', unitPrice: 9500, purchasePrice: 4800, unit: 'ml' },
    { name: 'Premium Oud', categoryId: oud.id, productType: 'PER_ML', unitPrice: 20000, purchasePrice: 10000, unit: 'ml' },
    { name: 'Arabian Oud', categoryId: oud.id, productType: 'PER_ML', unitPrice: 17000, purchasePrice: 8500, unit: 'ml' },

    // Bakhoor
    { name: 'Bakhoor Classic', categoryId: bakhoor.id, productType: 'FIXED', unitPrice: 45000, purchasePrice: 22000, unit: 'packet' },
    { name: 'Bakhoor Royal', categoryId: bakhoor.id, productType: 'FIXED', unitPrice: 75000, purchasePrice: 38000, unit: 'packet' },
    { name: 'Bakhoor Mabsoos', categoryId: bakhoor.id, productType: 'FIXED', unitPrice: 55000, purchasePrice: 28000, unit: 'packet' },
    { name: 'Bakhoor Al Arabian', categoryId: bakhoor.id, productType: 'FIXED', unitPrice: 65000, purchasePrice: 32000, unit: 'packet' },
    { name: 'Incense Cones', categoryId: bakhoor.id, productType: 'FIXED', unitPrice: 25000, purchasePrice: 12000, unit: 'packet' },
    { name: 'Oud Chips 25g', categoryId: bakhoor.id, productType: 'FIXED', unitPrice: 120000, purchasePrice: 60000, unit: 'packet' },
    { name: 'Oud Chips 50g', categoryId: bakhoor.id, productType: 'FIXED', unitPrice: 220000, purchasePrice: 110000, unit: 'packet' },
    { name: 'Bukhoor Premium Box', categoryId: bakhoor.id, productType: 'FIXED', unitPrice: 150000, purchasePrice: 75000, unit: 'piece' },

    // Accessories — some without purchase price (optional)
    { name: 'Bottle 3ml Empty', categoryId: accessories.id, productType: 'FIXED', unitPrice: 1500, purchasePrice: 600, unit: 'piece' },
    { name: 'Bottle 6ml Empty', categoryId: accessories.id, productType: 'FIXED', unitPrice: 2500, purchasePrice: 1000, unit: 'piece' },
    { name: 'Bottle 12ml Empty', categoryId: accessories.id, productType: 'FIXED', unitPrice: 4000, purchasePrice: 1500, unit: 'piece' },
    { name: 'Premium Bottle 100ml', categoryId: accessories.id, productType: 'FIXED', unitPrice: 25000, purchasePrice: 10000, unit: 'piece' },
    { name: 'Roller Bottle 10ml', categoryId: accessories.id, productType: 'FIXED', unitPrice: 3500, purchasePrice: 1400, unit: 'piece' },
    { name: 'Spray Atomizer 30ml', categoryId: accessories.id, productType: 'FIXED', unitPrice: 8000, purchasePrice: 3200, unit: 'piece' },
    { name: 'Spray Atomizer 50ml', categoryId: accessories.id, productType: 'FIXED', unitPrice: 12000, purchasePrice: 4800, unit: 'piece' },
    { name: 'Gift Box Small', categoryId: accessories.id, productType: 'FIXED', unitPrice: 5000, purchasePrice: 2000, unit: 'piece' },
    { name: 'Gift Box Large', categoryId: accessories.id, productType: 'FIXED', unitPrice: 12000, purchasePrice: 5000, unit: 'piece' },
    { name: 'Velvet Pouch', categoryId: accessories.id, productType: 'FIXED', unitPrice: 3000, unit: 'piece' },
    { name: 'Dropper Cap', categoryId: accessories.id, productType: 'FIXED', unitPrice: 1000, unit: 'piece' },
    { name: 'Funnel Plastic', categoryId: accessories.id, productType: 'FIXED', unitPrice: 500, unit: 'piece' },
    { name: 'Sample Vial 1ml', categoryId: accessories.id, productType: 'FIXED', unitPrice: 800, unit: 'piece' },
    { name: 'Label Set (50)', categoryId: accessories.id, productType: 'FIXED', unitPrice: 15000, purchasePrice: 6000, unit: 'packet' },
    { name: 'Electric Burner', categoryId: accessories.id, productType: 'FIXED', unitPrice: 45000, purchasePrice: 25000, unit: 'piece' },
    { name: 'Charcoal Tablets', categoryId: accessories.id, productType: 'FIXED', unitPrice: 8000, purchasePrice: 3500, unit: 'packet' },
    { name: 'Bakhoor Burner Metal', categoryId: accessories.id, productType: 'FIXED', unitPrice: 35000, purchasePrice: 18000, unit: 'piece' },
    { name: 'Tester Strip Pack', categoryId: accessories.id, productType: 'FIXED', unitPrice: 2000, unit: 'packet' },
    { name: 'Glass Dropper Bottle', categoryId: accessories.id, productType: 'FIXED', unitPrice: 6000, purchasePrice: 2500, unit: 'piece' },
    { name: 'Travel Case', categoryId: accessories.id, productType: 'FIXED', unitPrice: 18000, purchasePrice: 8000, unit: 'piece' },
  ];

  let createdProducts = 0;
  let updatedProducts = 0;
  async function upsertProduct(p) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (!existing) {
      await prisma.product.create({ data: p });
      createdProducts += 1;
    } else {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          categoryId: p.categoryId,
          productType: p.productType,
          unitPrice: p.unitPrice ?? 0,
          purchasePrice: p.purchasePrice ?? null,
          unit: p.unit,
          isActive: true,
          isGroup: p.isGroup ?? false,
          parentId: p.parentId ?? null,
          bottleSizeMl: p.bottleSizeMl ?? null,
          sortOrder: p.sortOrder ?? 0,
        },
      });
      updatedProducts += 1;
    }
  }

  for (const p of products) {
    await upsertProduct(p);
  }

  // Spray parent groups + size children (billable sizes only)
  const sprayGroups = [
    {
      name: 'Zabaya Spray',
      sizes: [
        { ml: 10, sell: 15000, cost: 7000 },
        { ml: 20, sell: 28000, cost: 13000 },
        { ml: 30, sell: 40000, cost: 18000 },
      ],
    },
    {
      name: 'Amber Spray',
      sizes: [
        { ml: 30, sell: 60000, cost: 28000 },
        { ml: 50, sell: 90000, cost: 45000 },
        { ml: 100, sell: 160000, cost: 80000 },
      ],
    },
    {
      name: 'Oud Spray',
      sizes: [
        { ml: 30, sell: 70000, cost: 35000 },
        { ml: 50, sell: 110000, cost: 55000 },
        { ml: 100, sell: 180000, cost: 90000 },
      ],
    },
    {
      name: 'Musk Spray',
      sizes: [
        { ml: 50, sell: 90000, cost: 45000 },
        { ml: 100, sell: 150000, cost: 75000 },
      ],
    },
    {
      name: 'Hindi Oud Spray',
      sizes: [
        { ml: 30, sell: 100000, cost: 50000 },
        { ml: 50, sell: 160000, cost: 80000 },
        { ml: 100, sell: 250000, cost: 125000 },
      ],
    },
    {
      name: 'Rose Spray',
      sizes: [
        { ml: 50, sell: 80000, cost: 40000 },
        { ml: 100, sell: 140000, cost: 70000 },
      ],
    },
  ];

  for (const g of sprayGroups) {
    await upsertProduct({
      name: g.name,
      categoryId: spray.id,
      productType: 'SPRAY',
      unitPrice: 0,
      unit: 'piece',
      isGroup: true,
      sortOrder: 0,
    });
    const parent = await prisma.product.findFirst({ where: { name: g.name } });
    if (!parent) continue;
    for (const s of g.sizes) {
      await upsertProduct({
        name: `${g.name} ${s.ml}ml`,
        categoryId: spray.id,
        productType: 'SPRAY',
        unitPrice: s.sell,
        purchasePrice: s.cost,
        unit: 'piece',
        isGroup: false,
        parentId: parent.id,
        bottleSizeMl: s.ml,
        sortOrder: s.ml,
      });
    }
  }

  // Standalone sprays (no group)
  for (const p of [
    { name: 'Room Freshener 250ml', unitPrice: 80000, purchasePrice: 40000, bottleSizeMl: 250 },
    { name: 'Car Spray Oud 50ml', unitPrice: 60000, purchasePrice: 30000, bottleSizeMl: 50 },
    { name: 'Body Mist Sandal 100ml', unitPrice: 110000, purchasePrice: 55000, bottleSizeMl: 100 },
  ]) {
    await upsertProduct({
      ...p,
      categoryId: spray.id,
      productType: 'SPRAY',
      unit: 'piece',
      isGroup: false,
    });
  }

  console.log('Products upserted | created:', createdProducts, '| updated:', updatedProducts);

  const customers = [
    { name: 'Ravi Kumar', mobile: '9876543210', notes: 'Prefers Hindi Oud' },
    { name: 'Fatima Beevi', mobile: '9812345678', notes: 'Regular attar buyer' },
    { name: 'Mohammed Ali', mobile: '9988776655', notes: null },
    { name: 'Sneha Nair', mobile: '9765432109', notes: 'Gift orders' },
    { name: 'Abdul Rahman', mobile: '9123456780', notes: 'Bulk bakhoor' },
    { name: 'Priya Menon', mobile: '9898989898', notes: null },
    { name: 'Yusuf Khan', mobile: '9000011111', notes: 'Spray customer' },
    { name: 'Anitha R', mobile: '9555566666', notes: null },
    { name: 'Hassan M', mobile: '9333344444', notes: 'Wholesale' },
    { name: 'Deepa Krishnan', mobile: '9222233333', notes: null },
    { name: 'Salim P', mobile: '9111122222', notes: 'Walk-in regular' },
    { name: 'Meera Thomas', mobile: '9888877777', notes: null },
  ];

  let customerCount = 0;
  for (const c of customers) {
    const existing = await prisma.customer.findUnique({ where: { mobile: c.mobile } });
    if (!existing) {
      await prisma.customer.create({ data: c });
      customerCount += 1;
    } else {
      await prisma.customer.update({
        where: { id: existing.id },
        data: { name: c.name, notes: c.notes },
      });
    }
  }
  console.log('Customers upserted; newly created:', customerCount);

  let settings = await prisma.shopSettings.findFirst();
  if (!settings) {
    settings = await prisma.shopSettings.create({
      data: {
        shopName: 'Amwaj',
        address: 'Thiruvananthapuram, Kerala',
        phone: '9876500000',
        invoicePrefix: 'AMW',
        nextInvoiceSeq: 1,
      },
    });
    console.log('Shop settings created');
  } else {
    console.log('Shop settings kept (invoice seq not reset by seed)');
  }

  // No sample invoices — bill from the app so reports/P&L are real.
  console.log('Seed completed. No fake bills. Create bills in POS to test History & Reports.');
  console.log('Login: admin / amwaj2024  |  staff / staff1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
