/**
 * Amwaj POS — full catalog seed (v1.6.8)
 *
 * Creates:
 *   - Users: admin (OWNER), staff (STAFF)
 *   - Categories: Attar, Oud, Spray, Bakhoor, Accessories
 *   - Attar / Oud / Bakhoor products with stock
 *   - Accessories: Spray Water + spray bottles 10/20/30/40/50/100 ml
 *   - Spray groups (Zabaya, Amber, Rose, Musk, Oud, Hindi Oud)
 *     each with size children 10, 20, 30, 40, 50, 100 ml
 *     recipe: oil + water + matching bottle (50% oil default)
 *   - Sample customers, shop settings
 * Does NOT create invoices.
 *
 * FULL RESET (wipes ALL data, re-migrates, re-seeds):
 *   cd backend
 *   npx prisma migrate reset --force
 *
 * Or from repo root:
 *   npm run db:reset
 *
 * Seed only (no wipe — upserts by product name):
 *   cd backend && node prisma/seed.js
 *
 * Login: admin / amwaj2024  |  staff / staff1234
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const STANDARD_SPRAY_SIZES = [10, 20, 30, 40, 50, 100];

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
  console.log('Admin (OWNER):', admin.username);

  const staffHash = await bcrypt.hash('staff1234', 12);
  await prisma.user.upsert({
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
  console.log('Staff: staff / staff1234');

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
      create: { name: cat.name, sortOrder: cat.sortOrder },
    });
  }

  const attar = await prisma.category.findUnique({ where: { name: 'Attar' } });
  const oud = await prisma.category.findUnique({ where: { name: 'Oud' } });
  const spray = await prisma.category.findUnique({ where: { name: 'Spray' } });
  const bakhoor = await prisma.category.findUnique({ where: { name: 'Bakhoor' } });
  const accessories = await prisma.category.findUnique({ where: { name: 'Accessories' } });

  let createdProducts = 0;
  let updatedProducts = 0;

  async function upsertProduct(p) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    const data = {
      categoryId: p.categoryId,
      productType: p.productType,
      unitPrice: p.unitPrice ?? 0,
      purchasePrice: p.purchasePrice ?? null,
      unit: p.unit,
      isActive: true,
      isGroup: p.isGroup ?? false,
      parentId: p.parentId ?? null,
      bottleSizeMl: p.bottleSizeMl ?? null,
      stockQty: p.stockQty != null ? p.stockQty : existing?.stockQty ?? 0,
      oilProductId: p.oilProductId ?? null,
      waterProductId: p.waterProductId ?? null,
      bottleProductId: p.bottleProductId ?? null,
      oilRatioPercent: p.oilRatioPercent != null ? p.oilRatioPercent : 50,
      sortOrder: p.sortOrder ?? 0,
    };
    if (!existing) {
      await prisma.product.create({ data: { name: p.name, ...data } });
      createdProducts += 1;
    } else {
      await prisma.product.update({ where: { id: existing.id }, data });
      updatedProducts += 1;
    }
  }

  // --- Attar (oil stock in ml) ---
  const attars = [
    ['Amber Attar', 9000, 4500, 500],
    ['Mogra Attar', 8500, 4200, 400],
    ['Rose Attar', 11000, 5500, 350],
    ['Jasmine Attar', 9500, 4800, 300],
    ['Kewra Attar', 8000, 4000, 400],
    ['Hina Attar', 10000, 5000, 250],
    ['Shamama Attar', 12000, 6000, 200],
    ['Motia Attar', 8800, 4400, 300],
    ['Khus Attar', 9200, 4600, 300],
    ['Sandal Attar', 15000, 7500, 200],
    ['White Musk Attar', 10500, 5200, 400],
    ['Black Musk Attar', 11500, 5800, 350],
    ['Zabaya Attar', 10000, 5000, 600], // oil used by Zabaya Spray
  ];
  for (const [n, sell, cost, stock] of attars) {
    await upsertProduct({
      name: n,
      categoryId: attar.id,
      productType: 'PER_ML',
      unitPrice: sell,
      purchasePrice: cost,
      unit: 'ml',
      stockQty: stock,
    });
  }

  // --- Oud ---
  const ouds = [
    ['Royal Oud', 10000, 5000, 300],
    ['White Oud', 12000, 6000, 250],
    ['Hindi Oud', 18000, 9000, 200],
    ['Cambodi Oud', 22000, 11000, 150],
    ['Assam Oud', 16000, 8000, 180],
  ];
  for (const [n, sell, cost, stock] of ouds) {
    await upsertProduct({
      name: n,
      categoryId: oud.id,
      productType: 'PER_ML',
      unitPrice: sell,
      purchasePrice: cost,
      unit: 'ml',
      stockQty: stock,
    });
  }

  // --- Bakhoor FIXED ---
  for (const [n, sell, cost, stock] of [
    ['Royal Bakhoor', 25000, 12000, 40],
    ['Oud Bakhoor Box', 45000, 22000, 25],
    ['Rose Bakhoor', 20000, 10000, 30],
    ['Musk Bakhoor', 22000, 11000, 28],
  ]) {
    await upsertProduct({
      name: n,
      categoryId: bakhoor.id,
      productType: 'FIXED',
      unitPrice: sell,
      purchasePrice: cost,
      unit: 'packet',
      stockQty: stock,
    });
  }

  // --- Accessories: spray water + bottles + tools ---
  await upsertProduct({
    name: 'Spray Water',
    categoryId: accessories.id,
    productType: 'FIXED',
    unitPrice: 100, // ₹1/ml internal ref
    purchasePrice: 50,
    unit: 'ml',
    stockQty: 5000,
    sortOrder: 1,
  });

  const bottleDefs = [
    { ml: 10, sell: 500, cost: 200, stock: 100 },
    { ml: 20, sell: 800, cost: 350, stock: 80 },
    { ml: 30, sell: 1000, cost: 450, stock: 80 },
    { ml: 40, sell: 1200, cost: 550, stock: 60 },
    { ml: 50, sell: 1500, cost: 700, stock: 60 },
    { ml: 100, sell: 2500, cost: 1200, stock: 40 },
  ];
  for (const b of bottleDefs) {
    await upsertProduct({
      name: `${b.ml} ml Spray Bottle`,
      categoryId: accessories.id,
      productType: 'FIXED',
      unitPrice: b.sell,
      purchasePrice: b.cost,
      unit: 'piece',
      bottleSizeMl: b.ml,
      stockQty: b.stock,
      sortOrder: b.ml,
    });
  }

  for (const [n, sell, cost, unit, stock] of [
    ['Empty Attar Bottle 3ml', 1500, 600, 'piece', 50],
    ['Empty Attar Bottle 6ml', 2500, 1000, 'piece', 40],
    ['Velvet Pouch', 3000, 1200, 'piece', 30],
    ['Dropper Cap', 1000, 400, 'piece', 100],
    ['Funnel Plastic', 500, 150, 'piece', 40],
    ['Sample Vial 1ml', 800, 300, 'piece', 200],
    ['Label Set (50)', 15000, 6000, 'packet', 15],
    ['Electric Burner', 45000, 25000, 'piece', 5],
    ['Charcoal Tablets', 8000, 3500, 'packet', 20],
    ['Bakhoor Burner Metal', 35000, 18000, 'piece', 8],
    ['Tester Strip Pack', 2000, 800, 'packet', 25],
    ['Travel Case', 18000, 8000, 'piece', 12],
  ]) {
    await upsertProduct({
      name: n,
      categoryId: accessories.id,
      productType: 'FIXED',
      unitPrice: sell,
      purchasePrice: cost,
      unit,
      stockQty: stock,
    });
  }

  // Resolve IDs for recipe links
  const byName = async (n) => prisma.product.findFirst({ where: { name: n } });
  const sprayWater = await byName('Spray Water');
  const bottlesByMl = {};
  for (const ml of STANDARD_SPRAY_SIZES) {
    bottlesByMl[ml] = await byName(`${ml} ml Spray Bottle`);
  }

  /**
   * Spray groups: oil linked + 50% default ratio + standard sizes.
   * Selling price per size is set on the child (customer sees one line).
   */
  const sprayGroups = [
    {
      name: 'Zabaya Spray',
      oilName: 'Zabaya Attar',
      ratio: 50,
      // sell paise by size
      prices: { 10: 15000, 20: 28000, 30: 40000, 40: 52000, 50: 65000, 100: 120000 },
    },
    {
      name: 'Amber Spray',
      oilName: 'Amber Attar',
      ratio: 50,
      prices: { 10: 14000, 20: 26000, 30: 38000, 40: 50000, 50: 62000, 100: 115000 },
    },
    {
      name: 'Rose Spray',
      oilName: 'Rose Attar',
      ratio: 50,
      prices: { 10: 16000, 20: 30000, 30: 42000, 40: 55000, 50: 70000, 100: 130000 },
    },
    {
      name: 'Musk Spray',
      oilName: 'White Musk Attar',
      ratio: 50,
      prices: { 10: 15000, 20: 28000, 30: 40000, 40: 52000, 50: 65000, 100: 120000 },
    },
    {
      name: 'Oud Spray',
      oilName: 'Royal Oud',
      ratio: 50,
      prices: { 10: 18000, 20: 34000, 30: 48000, 40: 62000, 50: 80000, 100: 150000 },
    },
    {
      name: 'Hindi Oud Spray',
      oilName: 'Hindi Oud',
      ratio: 50,
      prices: { 10: 22000, 20: 40000, 30: 58000, 40: 75000, 50: 100000, 100: 180000 },
    },
  ];

  for (const g of sprayGroups) {
    const oil = await byName(g.oilName);
    // Flat spray (like attar): one catalog row. unitPrice = ₹/ml of finished spray
    // Derive from 10 ml list price if present
    const perMl = g.prices[10] != null ? Math.round(g.prices[10] / 10) : 1500;
    await upsertProduct({
      name: g.name,
      categoryId: spray.id,
      productType: 'SPRAY',
      unitPrice: perMl,
      purchasePrice: oil?.purchasePrice ?? null,
      unit: 'ml',
      isGroup: false,
      parentId: null,
      stockQty: 0,
      oilProductId: oil?.id || null,
      waterProductId: sprayWater?.id || null,
      oilRatioPercent: g.ratio,
      bottleProductId: null,
      sortOrder: 0,
    });
  }



  // Standalone finished sprays (no recipe — deduct own stock if any)
  for (const p of [
    { name: 'Room Freshener 250ml', unitPrice: 80000, purchasePrice: 40000, bottleSizeMl: 250, stock: 20 },
    { name: 'Car Spray Oud 50ml', unitPrice: 60000, purchasePrice: 30000, bottleSizeMl: 50, stock: 15 },
    { name: 'Body Mist Sandal 100ml', unitPrice: 110000, purchasePrice: 55000, bottleSizeMl: 100, stock: 12 },
  ]) {
    await upsertProduct({
      ...p,
      categoryId: spray.id,
      productType: 'SPRAY',
      unit: 'piece',
      isGroup: false,
      stockQty: p.stock,
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
    await prisma.shopSettings.create({
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
    console.log('Shop settings kept (invoice seq not reset)');
  }

  console.log('Seed completed. Composite sprays: oil+water+bottle deduct on bill complete.');
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
