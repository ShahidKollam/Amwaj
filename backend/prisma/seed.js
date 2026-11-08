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
    create: { name, username, passwordHash, role: 'OWNER' },
  });
  console.log('Seeded admin:', admin.username);

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
      update: { sortOrder: cat.sortOrder },
      create: cat,
    });
  }

  const attar = await prisma.category.findUnique({ where: { name: 'Attar' } });
  const oud = await prisma.category.findUnique({ where: { name: 'Oud' } });
  const spray = await prisma.category.findUnique({ where: { name: 'Spray' } });
  const bakhoor = await prisma.category.findUnique({ where: { name: 'Bakhoor' } });
  const accessories = await prisma.category.findUnique({ where: { name: 'Accessories' } });

  const products = [
    { name: 'Amber Attar', categoryId: attar.id, productType: 'PER_ML', unitPrice: 9000, unit: 'ml' },
    { name: 'Mogra Attar', categoryId: attar.id, productType: 'PER_ML', unitPrice: 8500, unit: 'ml' },
    { name: 'Rose Attar', categoryId: attar.id, productType: 'PER_ML', unitPrice: 11000, unit: 'ml' },
    { name: 'Jasmine Attar', categoryId: attar.id, productType: 'PER_ML', unitPrice: 9500, unit: 'ml' },
    { name: 'Kewra Attar', categoryId: attar.id, productType: 'PER_ML', unitPrice: 8000, unit: 'ml' },
    { name: 'Hina Attar', categoryId: attar.id, productType: 'PER_ML', unitPrice: 10000, unit: 'ml' },
    { name: 'Shamama Attar', categoryId: attar.id, productType: 'PER_ML', unitPrice: 12000, unit: 'ml' },
    { name: 'Motia Attar', categoryId: attar.id, productType: 'PER_ML', unitPrice: 8800, unit: 'ml' },
    { name: 'Khus Attar', categoryId: attar.id, productType: 'PER_ML', unitPrice: 9200, unit: 'ml' },
    { name: 'Sandal Attar', categoryId: attar.id, productType: 'PER_ML', unitPrice: 15000, unit: 'ml' },
    { name: 'White Musk Attar', categoryId: attar.id, productType: 'PER_ML', unitPrice: 10500, unit: 'ml' },
    { name: 'Black Musk Attar', categoryId: attar.id, productType: 'PER_ML', unitPrice: 11500, unit: 'ml' },
    { name: 'Royal Oud', categoryId: oud.id, productType: 'PER_ML', unitPrice: 10000, unit: 'ml' },
    { name: 'White Oud', categoryId: oud.id, productType: 'PER_ML', unitPrice: 12000, unit: 'ml' },
    { name: 'Hindi Oud', categoryId: oud.id, productType: 'PER_ML', unitPrice: 18000, unit: 'ml' },
    { name: 'Cambodi Oud', categoryId: oud.id, productType: 'PER_ML', unitPrice: 22000, unit: 'ml' },
    { name: 'Assam Oud', categoryId: oud.id, productType: 'PER_ML', unitPrice: 16000, unit: 'ml' },
    { name: 'Thai Oud', categoryId: oud.id, productType: 'PER_ML', unitPrice: 14000, unit: 'ml' },
    { name: 'Oud Maliki', categoryId: oud.id, productType: 'PER_ML', unitPrice: 25000, unit: 'ml' },
    { name: 'Oud Special', categoryId: oud.id, productType: 'PER_ML', unitPrice: 13000, unit: 'ml' },
    { name: 'Burning Oud', categoryId: oud.id, productType: 'PER_ML', unitPrice: 11000, unit: 'ml' },
    { name: 'Dehn Al Oud', categoryId: oud.id, productType: 'PER_ML', unitPrice: 30000, unit: 'ml' },
    { name: 'Oud Muattar', categoryId: oud.id, productType: 'PER_ML', unitPrice: 9500, unit: 'ml' },
    { name: 'Premium Oud', categoryId: oud.id, productType: 'PER_ML', unitPrice: 20000, unit: 'ml' },
    { name: 'Arabian Oud', categoryId: oud.id, productType: 'PER_ML', unitPrice: 17000, unit: 'ml' },
    { name: 'Oud Spray 100ml', categoryId: spray.id, productType: 'SPRAY', unitPrice: 180000, unit: 'piece' },
    { name: 'Musk Spray 100ml', categoryId: spray.id, productType: 'SPRAY', unitPrice: 150000, unit: 'piece' },
    { name: 'Rose Spray 100ml', categoryId: spray.id, productType: 'SPRAY', unitPrice: 140000, unit: 'piece' },
    { name: 'Amber Spray 50ml', categoryId: spray.id, productType: 'SPRAY', unitPrice: 90000, unit: 'piece' },
    { name: 'White Oud Spray', categoryId: spray.id, productType: 'SPRAY', unitPrice: 200000, unit: 'piece' },
    { name: 'Hindi Oud Spray', categoryId: spray.id, productType: 'SPRAY', unitPrice: 250000, unit: 'piece' },
    { name: 'Attar Mix Spray', categoryId: spray.id, productType: 'SPRAY', unitPrice: 120000, unit: 'piece' },
    { name: 'Room Freshener', categoryId: spray.id, productType: 'SPRAY', unitPrice: 80000, unit: 'piece' },
    { name: 'Car Spray Oud', categoryId: spray.id, productType: 'SPRAY', unitPrice: 60000, unit: 'piece' },
    { name: 'Body Mist Sandal', categoryId: spray.id, productType: 'SPRAY', unitPrice: 110000, unit: 'piece' },
    { name: 'Bakhoor Classic', categoryId: bakhoor.id, productType: 'FIXED', unitPrice: 45000, unit: 'packet' },
    { name: 'Bakhoor Royal', categoryId: bakhoor.id, productType: 'FIXED', unitPrice: 75000, unit: 'packet' },
    { name: 'Bakhoor Mabsoos', categoryId: bakhoor.id, productType: 'FIXED', unitPrice: 55000, unit: 'packet' },
    { name: 'Bakhoor Al Arabian', categoryId: bakhoor.id, productType: 'FIXED', unitPrice: 65000, unit: 'packet' },
    { name: 'Incense Cones', categoryId: bakhoor.id, productType: 'FIXED', unitPrice: 25000, unit: 'packet' },
    { name: 'Oud Chips 25g', categoryId: bakhoor.id, productType: 'FIXED', unitPrice: 120000, unit: 'packet' },
    { name: 'Oud Chips 50g', categoryId: bakhoor.id, productType: 'FIXED', unitPrice: 220000, unit: 'packet' },
    { name: 'Bukhoor Premium Box', categoryId: bakhoor.id, productType: 'FIXED', unitPrice: 150000, unit: 'piece' },
    { name: 'Bottle 3ml Empty', categoryId: accessories.id, productType: 'FIXED', unitPrice: 1500, unit: 'piece' },
    { name: 'Bottle 6ml Empty', categoryId: accessories.id, productType: 'FIXED', unitPrice: 2500, unit: 'piece' },
    { name: 'Bottle 12ml Empty', categoryId: accessories.id, productType: 'FIXED', unitPrice: 4000, unit: 'piece' },
    { name: 'Premium Bottle 100ml', categoryId: accessories.id, productType: 'FIXED', unitPrice: 25000, unit: 'piece' },
    { name: 'Roller Bottle 10ml', categoryId: accessories.id, productType: 'FIXED', unitPrice: 3500, unit: 'piece' },
    { name: 'Spray Atomizer 30ml', categoryId: accessories.id, productType: 'FIXED', unitPrice: 8000, unit: 'piece' },
    { name: 'Spray Atomizer 50ml', categoryId: accessories.id, productType: 'FIXED', unitPrice: 12000, unit: 'piece' },
    { name: 'Gift Box Small', categoryId: accessories.id, productType: 'FIXED', unitPrice: 5000, unit: 'piece' },
    { name: 'Gift Box Large', categoryId: accessories.id, productType: 'FIXED', unitPrice: 12000, unit: 'piece' },
    { name: 'Velvet Pouch', categoryId: accessories.id, productType: 'FIXED', unitPrice: 3000, unit: 'piece' },
    { name: 'Dropper Cap', categoryId: accessories.id, productType: 'FIXED', unitPrice: 1000, unit: 'piece' },
    { name: 'Funnel Plastic', categoryId: accessories.id, productType: 'FIXED', unitPrice: 500, unit: 'piece' },
    { name: 'Sample Vial 1ml', categoryId: accessories.id, productType: 'FIXED', unitPrice: 800, unit: 'piece' },
    { name: 'Label Set (50)', categoryId: accessories.id, productType: 'FIXED', unitPrice: 15000, unit: 'packet' },
    { name: 'Electric Burner', categoryId: accessories.id, productType: 'FIXED', unitPrice: 45000, unit: 'piece' },
    { name: 'Charcoal Tablets', categoryId: accessories.id, productType: 'FIXED', unitPrice: 8000, unit: 'packet' },
    { name: 'Bakhoor Burner Metal', categoryId: accessories.id, productType: 'FIXED', unitPrice: 35000, unit: 'piece' },
    { name: 'Tester Strip Pack', categoryId: accessories.id, productType: 'FIXED', unitPrice: 2000, unit: 'packet' },
    { name: 'Glass Dropper Bottle', categoryId: accessories.id, productType: 'FIXED', unitPrice: 6000, unit: 'piece' },
    { name: 'Travel Case', categoryId: accessories.id, productType: 'FIXED', unitPrice: 18000, unit: 'piece' },
  ];

  let createdProducts = 0;
  for (const p of products) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (!existing) {
      await prisma.product.create({ data: p });
      createdProducts += 1;
    }
  }
  console.log('Products defined:', products.length, 'newly created:', createdProducts);

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

  const customerRecords = [];
  for (const c of customers) {
    const existing = await prisma.customer.findUnique({ where: { mobile: c.mobile } });
    customerRecords.push(existing || (await prisma.customer.create({ data: c })));
  }
  console.log('Customers:', customerRecords.length);

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
  }

  const invoiceCount = await prisma.invoice.count();
  if (invoiceCount === 0) {
    const allProducts = await prisma.product.findMany({ take: 20 });
    const pick = (i) => allProducts[i % Math.max(allProducts.length, 1)];
    const sampleBills = [
      { customerId: customerRecords[0]?.id, items: [{ p: pick(0), qty: 3 }, { p: pick(1), qty: 6 }], pay: 'CASH' },
      { customerId: customerRecords[1]?.id, items: [{ p: pick(2), qty: 5 }, { p: pick(5), qty: 1 }], pay: 'UPI' },
      { customerId: null, items: [{ p: pick(4), qty: 12 }], pay: 'CASH' },
      { customerId: customerRecords[2]?.id, items: [{ p: pick(3), qty: 4 }, { p: pick(8), qty: 1 }, { p: pick(10), qty: 2 }], pay: 'SPLIT' },
      { customerId: customerRecords[4]?.id, items: [{ p: pick(6), qty: 10 }, { p: pick(7), qty: 5 }], pay: 'UPI' },
    ];

    let seq = settings.nextInvoiceSeq || 1;
    for (const bill of sampleBills) {
      const lineItems = bill.items.filter((x) => x.p).map((x) => {
        const unit = x.p.unitPrice;
        const line = Math.round(Number(x.qty) * unit);
        return {
          productId: x.p.id,
          productName: x.p.name,
          productType: x.p.productType,
          unit: x.p.unit,
          quantity: x.qty,
          unitPricePaise: unit,
          lineTotalPaise: line,
          discountPaise: 0,
        };
      });
      if (!lineItems.length) continue;
      const subtotal = lineItems.reduce((s, it) => s + it.lineTotalPaise, 0);
      const invoiceNumber = (settings.invoicePrefix || 'AMW') + '-' + String(seq).padStart(5, '0');
      seq += 1;
      const payments =
        bill.pay === 'SPLIT'
          ? [
              { method: 'CASH', amountPaise: Math.floor(subtotal / 2) },
              { method: 'UPI', amountPaise: subtotal - Math.floor(subtotal / 2) },
            ]
          : [{ method: bill.pay, amountPaise: subtotal }];

      await prisma.invoice.create({
        data: {
          invoiceNumber,
          customerId: bill.customerId || null,
          createdById: admin.id,
          subtotalPaise: subtotal,
          additionalPaise: 0,
          discountPaise: 0,
          totalPaise: subtotal,
          items: { create: lineItems },
          payments: { create: payments },
        },
      });
    }
    await prisma.shopSettings.update({ where: { id: settings.id }, data: { nextInvoiceSeq: seq } });
    console.log('Sample invoices created');
  } else {
    console.log('Invoices already exist, skipped sample history');
  }

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
