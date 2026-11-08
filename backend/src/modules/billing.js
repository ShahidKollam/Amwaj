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
});

router.post('/complete', async (req, res, next) => {
  try {
    const body = createBillSchema.parse(req.body);

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

      subtotal += lineTotal;
      return {
        ...item,
        lineTotalPaise: lineTotal,
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
    const { search, from, to, limit = 50 } = req.query;
    const where = { status: 'COMPLETED' };
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { mobile: { contains: search } } },
      ];
    }
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        customer: { select: { name: true, mobile: true } },
        payments: true,
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit) || 50, 100),
    });
    res.json(invoices);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
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
    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

export default router;
