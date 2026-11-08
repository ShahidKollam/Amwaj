import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    let settings = await prisma.shopSettings.findFirst();
    if (!settings) {
      settings = await prisma.shopSettings.create({
        data: { shopName: 'Amwaj', invoicePrefix: 'AMW' },
      });
    }
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

const settingsSchema = z.object({
  shopName: z.string().min(1).optional(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  gstin: z.string().optional().nullable(),
  invoicePrefix: z.string().optional(),
  whatsappNumber: z.string().optional().nullable(),
});

router.put('/', async (req, res, next) => {
  try {
    const data = settingsSchema.parse(req.body);
    let settings = await prisma.shopSettings.findFirst();
    if (!settings) {
      settings = await prisma.shopSettings.create({ data: { ...data, shopName: data.shopName || 'Amwaj' } });
    } else {
      settings = await prisma.shopSettings.update({
        where: { id: settings.id },
        data,
      });
    }
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

// Basic reports
router.get('/reports/sales', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const where = { status: 'COMPLETED' };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: { payments: true, items: true },
    });

    const totalSales = invoices.reduce((s, inv) => s + inv.totalPaise, 0);
    const billCount = invoices.length;
    const avgBill = billCount ? Math.round(totalSales / billCount) : 0;

    const byMethod = { CASH: 0, UPI: 0 };
    invoices.forEach((inv) => {
      inv.payments.forEach((p) => {
        byMethod[p.method] = (byMethod[p.method] || 0) + p.amountPaise;
      });
    });

    // Top items
    const itemMap = {};
    invoices.forEach((inv) => {
      inv.items.forEach((it) => {
        if (!itemMap[it.productName]) {
          itemMap[it.productName] = { name: it.productName, qty: 0, revenue: 0 };
        }
        itemMap[it.productName].qty += Number(it.quantity);
        itemMap[it.productName].revenue += it.lineTotalPaise;
      });
    });
    const topItems = Object.values(itemMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    res.json({
      totalSalesPaise: totalSales,
      billCount,
      averageBillPaise: avgBill,
      byPaymentMethod: byMethod,
      topItems,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
