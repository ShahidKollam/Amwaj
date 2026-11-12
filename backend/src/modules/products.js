import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.use(requireAuth);

/** Strip purchasePrice for non-owners so staff never see cost */
function sanitizeProduct(product, isOwner) {
  if (!product) return product;
  if (Array.isArray(product.children)) {
    product = {
      ...product,
      children: product.children.map((c) => sanitizeProduct(c, isOwner)),
    };
  }
  if (isOwner) return product;
  const { purchasePrice, ...rest } = product;
  return rest;
}

function sanitizeProducts(list, isOwner) {
  return list.map((p) => sanitizeProduct(p, isOwner));
}

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
    if (search && String(search).trim()) {
      const q = String(search).trim();
      where.name = { contains: q, mode: 'insensitive' };
    }
    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        parent: {
          select: {
            id: true,
            name: true,
            isGroup: true,
            oilProductId: true,
            waterProductId: true,
            oilRatioPercent: true,
            oilProduct: { select: { id: true, name: true, unitPrice: true, unit: true, stockQty: true } },
            waterProduct: { select: { id: true, name: true, unitPrice: true, unit: true, stockQty: true } },
          },
        },
        oilProduct: { select: { id: true, name: true, unitPrice: true, unit: true, stockQty: true } },
        waterProduct: { select: { id: true, name: true, unitPrice: true, unit: true, stockQty: true } },
        bottleProduct: { select: { id: true, name: true, unitPrice: true, unit: true, stockQty: true, bottleSizeMl: true } },
        _count: { select: { children: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    const isOwner = req.user?.role === 'OWNER';
    res.json(sanitizeProducts(products, isOwner));
  } catch (err) {
    next(err);
  }
});

const productSchema = z.object({
  name: z.string().min(1),
  categoryId: z.string(),
  productType: z.enum(['PER_ML', 'SPRAY', 'FIXED']),
  // Group parents may use 0; sellable must be positive (validated below)
  unitPrice: z.number().int().nonnegative(),
  purchasePrice: z.number().int().nonnegative().nullable().optional(),
  unit: z.string().min(1),
  isActive: z.boolean().optional(),
  parentId: z.string().nullable().optional(),
  isGroup: z.boolean().optional(),
  bottleSizeMl: z.number().int().positive().nullable().optional(),
  // Total on-hand qty (ml or pieces). Groups forced to 0.
  stockQty: z.number().nonnegative().optional(),
  // Composite spray recipe
  oilProductId: z.string().nullable().optional(),
  waterProductId: z.string().nullable().optional(),
  bottleProductId: z.string().nullable().optional(),
  oilRatioPercent: z.number().min(0).max(100).optional(),
  stockGroupId: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

function assertSellablePrice(data) {
  const isGroup = data.isGroup === true;
  if (!isGroup && data.unitPrice != null && data.unitPrice <= 0) {
    const err = new Error('Selling price must be greater than zero for sellable products');
    err.status = 400;
    throw err;
  }
  if (isGroup) {
    // Groups are headings only (recipe lives here: oil/water/ratio)
    data.unitPrice = data.unitPrice ?? 0;
    data.parentId = null;
    data.stockQty = 0;
    data.bottleProductId = null;
  }
}

router.post('/', async (req, res, next) => {
  try {
    const data = productSchema.parse(req.body);
    assertSellablePrice(data);
    if (req.user?.role !== 'OWNER') {
      delete data.purchasePrice;
    }
    if (data.parentId) {
      const parent = await prisma.product.findUnique({ where: { id: data.parentId } });
      if (!parent) {
        return res.status(400).json({ error: 'Parent product not found' });
      }
      if (parent.parentId) {
        return res.status(400).json({ error: 'Cannot nest under a child product (max one level)' });
      }
      // Child inherits category/type defaults if needed
      data.isGroup = false;
    }
    const product = await prisma.product.create({
      data,
      include: {
        category: true,
        parent: {
          select: {
            id: true,
            name: true,
            isGroup: true,
            oilProductId: true,
            waterProductId: true,
            oilRatioPercent: true,
          },
        },
        oilProduct: { select: { id: true, name: true, unitPrice: true, unit: true, stockQty: true } },
        waterProduct: { select: { id: true, name: true, unitPrice: true, unit: true, stockQty: true } },
        bottleProduct: { select: { id: true, name: true, unitPrice: true, unit: true, stockQty: true, bottleSizeMl: true } },
      },
    });
    res.status(201).json(sanitizeProduct(product, req.user?.role === 'OWNER'));
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const data = productSchema.partial().parse(req.body);
    if (data.isGroup !== undefined || data.unitPrice !== undefined) {
      const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
      const merged = {
        isGroup: data.isGroup ?? existing?.isGroup,
        unitPrice: data.unitPrice ?? existing?.unitPrice,
      };
      assertSellablePrice(merged);
      if (merged.isGroup) data.unitPrice = merged.unitPrice ?? 0;
    }
    if (req.user?.role !== 'OWNER') {
      delete data.purchasePrice;
    }
    if (data.parentId) {
      if (data.parentId === req.params.id) {
        return res.status(400).json({ error: 'Product cannot be its own parent' });
      }
      const parent = await prisma.product.findUnique({ where: { id: data.parentId } });
      if (!parent) return res.status(400).json({ error: 'Parent product not found' });
      if (parent.parentId) {
        return res.status(400).json({ error: 'Cannot nest under a child product' });
      }
      data.isGroup = false;
    }
    const existing = await prisma.product.findUnique({
      where: { id: req.params.id },
      select: { stockGroupId: true, stockQty: true },
    });
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data,
      include: {
        category: true,
        parent: {
          select: {
            id: true,
            name: true,
            isGroup: true,
            oilProductId: true,
            waterProductId: true,
            oilRatioPercent: true,
          },
        },
        oilProduct: { select: { id: true, name: true, unitPrice: true, unit: true, stockQty: true } },
        waterProduct: { select: { id: true, name: true, unitPrice: true, unit: true, stockQty: true } },
        bottleProduct: { select: { id: true, name: true, unitPrice: true, unit: true, stockQty: true, bottleSizeMl: true } },
      },
    });
    // Shared stock: editing qty on one mirror updates Attar + Oud + Spray together
    const groupId = data.stockGroupId !== undefined ? data.stockGroupId : existing?.stockGroupId;
    if (
      groupId &&
      data.stockQty != null &&
      Number(data.stockQty) !== Number(existing?.stockQty)
    ) {
      await prisma.product.updateMany({
        where: { stockGroupId: groupId },
        data: { stockQty: data.stockQty },
      });
    }
    res.json(sanitizeProduct(product, req.user?.role === 'OWNER'));
  } catch (err) {
    next(err);
  }
});

/** Hard delete product (permanent). Fails if referenced by invoice items — returns clear error. */
router.delete('/:id', async (req, res, next) => {
  try {
    const childCount = await prisma.product.count({ where: { parentId: req.params.id } });
    if (childCount > 0) {
      return res.status(409).json({
        error: 'Cannot delete: this group has size variants. Remove or reassign children first.',
      });
    }
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
