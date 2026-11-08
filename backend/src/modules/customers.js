import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query;
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { mobile: { contains: search } },
          ],
        }
      : {};
    const customers = await prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(customers);
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
    const existing = await prisma.customer.findUnique({ where: { mobile: normalized } });
    if (existing) {
      return res.status(409).json({ error: 'Customer with this mobile already exists', customer: existing });
    }
    const customer = await prisma.customer.create({
      data: { ...data, mobile: normalized },
    });
    res.status(201).json(customer);
  } catch (err) {
    next(err);
  }
});

export default router;
