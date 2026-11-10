import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();
router.use(requireAuth);

// Helper: money in paise
function toPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}

const itemSchema = z.object({
  productId: z.string().optional().nullable(),
  productName: z.string().min(1),
  productType: z.enum(['PER_ML', 'SPRAY', 'FIXED']),
  unit: z.string(),
  quantity: z.number().positive(),
  unitPricePaise: z.number().int().nonnegative(),
  discountPaise: z.number().int().nonnegative().default(0),
  sprayBottleMl: z.number().int().positive().optional().nullable(),
  sprayOilMl: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const createBillSchema = z.object({
  customerId: z.string().optional().nullable(),
  items: z.array(itemSchema).min(1),
  additionalPaise: z.number().int().nonnegative().default(0),
  discountPaise: z.number().int().nonnegative().default(0),
  payments: z.array(
    z.object({
      method: z.enum(['CASH', 'UPI']),
      amountPaise: z.number().int().positive(),
    })
  ).min(1),
  notes: z.string().optional().nullable(),
  idempotencyKey: z.string().min(8).max(80).optional().nullable(),
});

router.post('/complete', async (req, res, next) => {
  try {
    const body = createBillSchema.parse(req.body);

    // Idempotency: return existing invoice if same key already processed
    if (body.idempotencyKey) {
      const existing = await prisma.invoice.findUnique({
        where: { idempotencyKey: body.idempotencyKey },
        include: {
          items: true,
          payments: true,
          customer: true,
          createdBy: { select: { name: true } },
        },
      });
      if (existing) {
        return res.status(200).json(existing);
      }
    }

    // Snapshot purchase prices; reject group (parent) products — not sellable
    const productIds = [
      ...new Set(
        body.items.map((it) => it.productId).filter((id) => id && typeof id === 'string')
      ),
    ];
    const purchaseByProduct = {};
    if (productIds.length) {
      const prods = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, purchasePrice: true, isGroup: true, name: true },
      });
      const groupHit = prods.find((p) => p.isGroup);
      if (groupHit) {
        return res.status(400).json({
          error: `"${groupHit.name}" is a product group. Add a bottle size variant instead.`,
        });
      }
      prods.forEach((p) => {
        purchaseByProduct[p.id] =
          p.purchasePrice != null && p.purchasePrice >= 0 ? p.purchasePrice : null;
      });
    }

    // Calculate line totals and validate
    let subtotal = 0;
    const processedItems = body.items.map((item) => {
      let lineTotal = Math.round(item.quantity * item.unitPricePaise) - (item.discountPaise || 0);
      if (lineTotal < 0) lineTotal = 0;

      // Spray validation
      if (item.productType === 'SPRAY') {
        if (item.sprayBottleMl && item.sprayOilMl) {
          if (item.sprayOilMl > item.sprayBottleMl) {
            throw Object.assign(new Error('Oil quantity cannot exceed bottle size'), { status: 400 });
          }
        }
      }

      const purchasePricePaise =
        item.productId && purchaseByProduct[item.productId] != null
          ? purchaseByProduct[item.productId]
          : null;

      subtotal += lineTotal;
      return {
        ...item,
        lineTotalPaise: lineTotal,
        purchasePricePaise,
        sprayLiquidMl: item.sprayBottleMl && item.sprayOilMl
          ? item.sprayBottleMl - item.sprayOilMl
          : null,
      };
    });

    const additional = body.additionalPaise || 0;
    const discount = body.discountPaise || 0;
    const total = subtotal + additional - discount;
    if (total < 0) {
      return res.status(400).json({ error: 'Total cannot be negative' });
    }

    const paid = body.payments.reduce((s, p) => s + p.amountPaise, 0);
    if (paid !== total) {
      return res.status(400).json({
        error: `Payment total (${paid}) must equal bill total (${total})`,
      });
    }

    // Transaction
    const result = await prisma.$transaction(async (tx) => {
      // Get next invoice number
      let settings = await tx.shopSettings.findFirst();
      if (!settings) {
        settings = await tx.shopSettings.create({
          data: { shopName: 'Amwaj', invoicePrefix: 'AMW', nextInvoiceSeq: 1 },
        });
      }
      const seq = settings.nextInvoiceSeq;
      const invoiceNumber = `${settings.invoicePrefix}-${String(seq).padStart(5, '0')}`;

      await tx.shopSettings.update({
        where: { id: settings.id },
        data: { nextInvoiceSeq: seq + 1 },
      });

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          idempotencyKey: body.idempotencyKey || null,
          customerId: body.customerId || null,
          createdById: req.user.id,
          subtotalPaise: subtotal,
          additionalPaise: additional,
          discountPaise: discount,
          totalPaise: total,
          notes: body.notes || null,
          items: {
            create: processedItems.map((it) => ({
              productId: it.productId || null,
              productName: it.productName,
              productType: it.productType,
              unit: it.unit,
              quantity: new Prisma.Decimal(it.quantity),
              unitPricePaise: it.unitPricePaise,
              purchasePricePaise:
                it.purchasePricePaise != null ? it.purchasePricePaise : null,
              lineTotalPaise: it.lineTotalPaise,
              discountPaise: it.discountPaise || 0,
              sprayBottleMl: it.sprayBottleMl || null,
              sprayOilMl: it.sprayOilMl || null,
              sprayLiquidMl: it.sprayLiquidMl || null,
              notes: it.notes || null,
            })),
          },
          payments: {
            create: body.payments.map((p) => ({
              method: p.method,
              amountPaise: p.amountPaise,
            })),
          },
        },
        include: {
          items: true,
          payments: true,
          customer: true,
          createdBy: { select: { name: true } },
        },
      });

      return invoice;
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const { search, from, to, date, page = 1, pageSize = 20 } = req.query;
    const where = { status: 'COMPLETED' };

    if (search && String(search).trim()) {
      const q = String(search).trim();
      where.OR = [
        { invoiceNumber: { contains: q, mode: 'insensitive' } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
        { customer: { mobile: { contains: q, mode: 'insensitive' } } },
      ];
    }

    // Single day filter (preferred for POS day view)
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.createdAt = { gte: start, lte: end };
    } else if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const take = Math.min(Math.max(Number(pageSize) || 20, 1), 50);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const isOwner = req.user?.role === 'OWNER';

    const [invoices, total, aggregates] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          customer: { select: { name: true, mobile: true } },
          payments: true,
          _count: { select: { items: true } },
          // Owner needs items for per-invoice cost; keep lean for staff
          ...(isOwner
            ? {
                items: {
                  select: {
                    quantity: true,
                    unitPricePaise: true,
                    purchasePricePaise: true,
                    lineTotalPaise: true,
                    discountPaise: true,
                  },
                },
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.invoice.count({ where }),
      prisma.invoice.aggregate({
        where,
        _sum: { totalPaise: true },
        _count: true,
      }),
    ]);

    let dayCostPaise = null;
    let dayProfitPaise = null;
    let dayCostKnown = false;

    if (isOwner) {
      // Full-day cost from all matching invoices (not just current page)
      const dayItems = await prisma.invoiceItem.findMany({
        where: { invoice: where },
        select: {
          quantity: true,
          purchasePricePaise: true,
          lineTotalPaise: true,
        },
      });
      let cost = 0;
      let anyKnown = false;
      dayItems.forEach((it) => {
        if (it.purchasePricePaise != null) {
          anyKnown = true;
          cost += Math.round(Number(it.quantity) * it.purchasePricePaise);
        }
      });
      dayCostKnown = anyKnown;
      dayCostPaise = anyKnown ? cost : null;
      dayProfitPaise =
        anyKnown && aggregates._sum.totalPaise != null
          ? (aggregates._sum.totalPaise || 0) - cost
          : null;
    }

    const itemsOut = invoices.map((inv) => {
      if (!isOwner) return inv;
      let invCost = 0;
      let hasCost = false;
      (inv.items || []).forEach((it) => {
        if (it.purchasePricePaise != null) {
          hasCost = true;
          invCost += Math.round(Number(it.quantity) * it.purchasePricePaise);
        }
      });
      const { items, ...rest } = inv;
      return {
        ...rest,
        costPaise: hasCost ? invCost : null,
        profitPaise: hasCost ? (inv.totalPaise || 0) - invCost : null,
      };
    });

    res.json({
      items: itemsOut,
      total,
      page: Math.max(Number(page) || 1, 1),
      pageSize: take,
      totalPages: Math.ceil(total / take) || 1,
      dayTotalPaise: aggregates._sum.totalPaise || 0,
      dayBillCount: aggregates._count || 0,
      ...(isOwner
        ? {
            dayCostPaise,
            dayProfitPaise,
            dayCostKnown,
          }
        : {}),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const isOwner = req.user?.role === 'OWNER';
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        items: true,
        payments: true,
        customer: true,
        createdBy: { select: { name: true } },
      },
    });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    if (!isOwner) {
      // Strip cost fields from line items for staff
      const items = (invoice.items || []).map((it) => {
        const { purchasePricePaise, ...rest } = it;
        return rest;
      });
      return res.json({ ...invoice, items });
    }

    // Owner: attach line cost/profit for UI
    let invCost = 0;
    let hasCost = false;
    const items = (invoice.items || []).map((it) => {
      const lineCost =
        it.purchasePricePaise != null
          ? Math.round(Number(it.quantity) * it.purchasePricePaise)
          : null;
      if (lineCost != null) {
        hasCost = true;
        invCost += lineCost;
      }
      return {
        ...it,
        lineCostPaise: lineCost,
        lineProfitPaise:
          lineCost != null ? (it.lineTotalPaise || 0) - lineCost : null,
      };
    });

    res.json({
      ...invoice,
      items,
      costPaise: hasCost ? invCost : null,
      profitPaise: hasCost ? (invoice.totalPaise || 0) - invCost : null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
