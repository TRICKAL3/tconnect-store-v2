import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { basicAdminAuth } from '../lib/adminAuth';

const router = Router();

router.get('/', async (_req, res) => {
  const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(products);
});

// Create/update (temporarily open for setup)
router.post('/', basicAdminAuth, async (req: any, res) => {
  const product = await prisma.product.create({ data: req.body });
  res.json(product);
});

router.put('/:id', basicAdminAuth, async (req: any, res) => {
  const product = await prisma.product.update({ where: { id: req.params.id }, data: req.body });
  res.json(product);
});

export default router;

