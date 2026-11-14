import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { requireAuth, requireOwner } from '../middlewares/auth.js';

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

router.put('/', requireOwner, async (req, res, next) => {
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

// Basic reports — owner only
router.get('/reports/sales', requireOwner, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const where = { status: 'COMPLETED' };
    if (from || to) {
      where.createdAt = {};
      if (from) {
        const start = new Date(from);
        start.setHours(0, 0, 0, 0);
        where.createdAt.gte = start;
      }
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        payments: true,
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                productType: true,
                unit: true,
                unitPrice: true,
                purchasePrice: true,
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
        customer: { select: { id: true, name: true, mobile: true } },
      },
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

    // Cost & profit from snapped purchase prices (null purchase → excluded from cost)
    let totalCost = 0;
    let costKnown = false;
    invoices.forEach((inv) => {
      inv.items.forEach((it) => {
        if (it.purchasePricePaise != null) {
          costKnown = true;
          totalCost += Math.round(Number(it.quantity) * it.purchasePricePaise);
        }
      });
    });
    const totalProfit = costKnown ? totalSales - totalCost : null;

    // Top items with optional cost/profit
    const itemMap = {};
    invoices.forEach((inv) => {
      inv.items.forEach((it) => {
        if (!itemMap[it.productName]) {
          itemMap[it.productName] = {
            name: it.productName,
            qty: 0,
            revenue: 0,
            cost: 0,
            costKnown: false,
          };
        }
        const row = itemMap[it.productName];
        row.qty += Number(it.quantity);
        row.revenue += it.lineTotalPaise;
        if (it.purchasePricePaise != null) {
          row.costKnown = true;
          row.cost += Math.round(Number(it.quantity) * it.purchasePricePaise);
        }
      });
    });
    const topItems = Object.values(itemMap)
      .map((row) => ({
        name: row.name,
        qty: row.qty,
        revenue: row.revenue,
        costPaise: row.costKnown ? row.cost : null,
        profitPaise: row.costKnown ? row.revenue - row.cost : null,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Top customers by sales in range (walk-in grouped)
    const custMap = {};
    invoices.forEach((inv) => {
      const key = inv.customerId || 'walk-in';
      if (!custMap[key]) {
        custMap[key] = {
          customerId: inv.customerId || null,
          name: inv.customer?.name || 'Walk-in',
          mobile: inv.customer?.mobile || null,
          billCount: 0,
          revenue: 0,
        };
      }
      custMap[key].billCount += 1;
      custMap[key].revenue += inv.totalPaise;
    });
    const topCustomers = Object.values(custMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Full item-wise retail summary (all lines in range)
    const retailMap = {};
    invoices.forEach((inv) => {
      inv.items.forEach((it) => {
        const key =
          it.productId ||
          `${it.productName}|${it.productType || ''}|${it.unit || ''}`;
        if (!retailMap[key]) {
          const cat =
            it.product?.category?.name ||
            (it.productType === 'SPRAY'
              ? 'Spray'
              : it.productType === 'PER_ML'
                ? 'Per ml'
                : it.productType === 'FIXED'
                  ? 'Fixed'
                  : '—');
          retailMap[key] = {
            key,
            name: it.productName,
            category: cat,
            productType: it.productType || it.product?.productType || null,
            unit: it.unit || it.product?.unit || '',
            qty: 0,
            revenue: 0,
            cost: 0,
            costKnown: false,
            sellRateSum: 0, // weighted by qty for average sell rate
            purchaseRateSum: 0,
            purchaseRateQty: 0,
          };
        }
        const row = retailMap[key];
        const q = Number(it.quantity) || 0;
        row.qty += q;
        row.revenue += it.lineTotalPaise || 0;
        row.sellRateSum += (Number(it.unitPricePaise) || 0) * q;
        if (it.purchasePricePaise != null) {
          row.costKnown = true;
          row.cost += Math.round(q * it.purchasePricePaise);
          row.purchaseRateSum += Number(it.purchasePricePaise) * q;
          row.purchaseRateQty += q;
        }
      });
    });

    const itemRetail = Object.values(retailMap)
      .map((row) => {
        const avgSell =
          row.qty > 0 ? Math.round(row.sellRateSum / row.qty) : null;
        const avgPurchase =
          row.purchaseRateQty > 0
            ? Math.round(row.purchaseRateSum / row.purchaseRateQty)
            : null;
        return {
          name: row.name,
          category: row.category,
          productType: row.productType,
          unit: row.unit,
          qty: Math.round(row.qty * 1000) / 1000,
          sellRatePaise: avgSell,
          purchaseRatePaise: avgPurchase,
          salesPaise: row.revenue,
          costPaise: row.costKnown ? row.cost : null,
          profitPaise: row.costKnown ? row.revenue - row.cost : null,
        };
      })
      .sort((a, b) => b.salesPaise - a.salesPaise);

    const retailSales = itemRetail.reduce((s, r) => s + r.salesPaise, 0);
    const retailCostKnown = itemRetail.some((r) => r.costPaise != null);
    const retailCost = retailCostKnown
      ? itemRetail.reduce((s, r) => s + (r.costPaise || 0), 0)
      : null;
    const retailProfit =
      retailCost != null ? retailSales - retailCost : null;

    res.json({
      totalSalesPaise: totalSales,
      billCount,
      averageBillPaise: avgBill,
      byPaymentMethod: byMethod,
      totalCostPaise: costKnown ? totalCost : null,
      totalProfitPaise: totalProfit,
      costKnown,
      topItems,
      topCustomers,
      itemRetail,
      itemRetailTotals: {
        salesPaise: retailSales,
        costPaise: retailCost,
        profitPaise: retailProfit,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
