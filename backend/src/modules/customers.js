import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const { search, page = 1, pageSize = 20, date, from, to } = req.query;
    const where = {};
    if (search && String(search).trim()) {
      const q = String(search).trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { mobile: { contains: q, mode: 'insensitive' } },
      ];
    }
    // Optional created-date filter (single day or range)
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

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.customer.count({ where }),
    ]);

    res.json({
      items: customers,
      total,
      page: Math.max(Number(page) || 1, 1),
      pageSize: take,
      totalPages: Math.ceil(total / take) || 1,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            invoiceNumber: true,
            totalPaise: true,
            createdAt: true,
            status: true,
          },
        },
      },
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

const customerSchema = z.object({
  name: z.string().min(1),
  mobile: z.string().min(8).max(15),
  notes: z.string().optional(),
});

router.post('/', async (req, res, next) => {
  try {
    const data = customerSchema.parse(req.body);
    const normalized = data.mobile.replace(/\D/g, '');
    if (normalized.length < 10 || normalized.length > 15) {
      return res.status(400).json({ error: 'Mobile number must be 10–15 digits' });
    }
    const existing = await prisma.customer.findUnique({ where: { mobile: normalized } });
    if (existing) {
      return res.status(409).json({ error: 'Customer with this mobile already exists', customer: existing });
    }
    const customer = await prisma.customer.create({
      data: {
        name: data.name.trim(),
        mobile: normalized,
        notes: data.notes?.trim() || null,
      },
    });
    res.status(201).json(customer);
  } catch (err) {
    next(err);
  }
});

export default router;
