import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/categories', async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { categoryId, search, active } = req.query;
    const where = {};
    if (categoryId) where.categoryId = categoryId;
    if (active !== 'false') where.isActive = true;
    if (search) {
      where.name = { contains: search };
    }
    const products = await prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { name: 'asc' },
    });
    res.json(products);
  } catch (err) {
    next(err);
  }
});

const productSchema = z.object({
  name: z.string().min(1),
  categoryId: z.string(),
  productType: z.enum(['PER_ML', 'SPRAY', 'FIXED']),
  unitPrice: z.number().int().positive(), // paise
  unit: z.string().min(1),
  isActive: z.boolean().optional(),
});

router.post('/', async (req, res, next) => {
  try {
    const data = productSchema.parse(req.body);
    const product = await prisma.product.create({ data });
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const data = productSchema.partial().parse(req.body);
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data,
      include: { category: true },
    });
    res.json(product);
  } catch (err) {
    next(err);
  }
});

/** Hard delete product (permanent). Fails if referenced by invoice items — returns clear error. */
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    res.json({ ok: true, id: req.params.id });
  } catch (err) {
    if (err.code === 'P2003' || err.code === 'P2014') {
      return res.status(409).json({
        error: 'Cannot delete: product is used on past bills. Deactivate it instead.',
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Product not found' });
    }
    next(err);
  }
});

export default router;
