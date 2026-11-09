import { verifyToken } from '../utils/auth.js';
import prisma from '../utils/prisma.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const token = header.slice(7);
    const decoded = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, username: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid or inactive user' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireOwner(req, res, next) {
  if (!req.user || req.user.role !== 'OWNER') {
    return res.status(403).json({ error: 'Owner access required' });
  }
  next();
}
