import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { comparePassword, hashPassword, signToken } from '../utils/auth.js';
import { requireAuth, requireOwner } from '../middlewares/auth.js';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = signToken({ userId: user.id, role: user.role });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

/** Change own password — any signed-in user (owner or staff) */
router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(6),
    });
    const { currentPassword, newPassword } = schema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const valid = await comparePassword(currentPassword, user.passwordHash);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/** List users — owner only */
router.get('/users', requireAuth, requireOwner, async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

/** Create staff account — owner only */
router.post('/users', requireAuth, requireOwner, async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      username: z.string().min(2),
      password: z.string().min(6),
    });
    const data = schema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { username: data.username } });
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    const passwordHash = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: {
        name: data.name.trim(),
        username: data.username.trim(),
        passwordHash,
        role: 'STAFF',
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

/** Update staff — owner only (name, password, active) */
router.patch('/users/:id', requireAuth, requireOwner, async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1).optional(),
      password: z.string().min(6).optional(),
      isActive: z.boolean().optional(),
    });
    const data = schema.parse(req.body);
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.role === 'OWNER') {
      return res.status(400).json({ error: 'Cannot edit owner account here' });
    }
    const update = {};
    if (data.name !== undefined) update.name = data.name.trim();
    if (data.isActive !== undefined) update.isActive = data.isActive;
    if (data.password) update.passwordHash = await hashPassword(data.password);
    const user = await prisma.user.update({
      where: { id: target.id },
      data: update,
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

export default router;
