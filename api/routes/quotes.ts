import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../lib/auth';

const router = Router();

router.get('/', authMiddleware, async (req: any, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const quotes = await prisma.quote.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(quotes);
});

router.post('/', authMiddleware, async (req: any, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const q = await prisma.quote.create({ data: req.body });
  res.json(q);
});

router.patch('/:id', authMiddleware, async (req: any, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const q = await prisma.quote.update({ where: { id: req.params.id }, data: req.body });
  res.json(q);
});

export default router;

