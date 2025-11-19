import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { basicAdminAuth } from '../lib/adminAuth';

const router = Router();

router.get('/', async (_req, res) => {
  const rates = await prisma.rate.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(rates);
});

router.post('/', basicAdminAuth, async (req: any, res) => {
  const rate = await prisma.rate.create({ data: req.body });
  res.json(rate);
});

export default router;

