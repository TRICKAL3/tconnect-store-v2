import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { basicAdminAuth } from '../lib/adminAuth';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(products);
  } catch (error: any) {
    console.error('Failed to load products:', error);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error: any) {
    console.error('Failed to fetch product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
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

router.delete('/:id', basicAdminAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    await prisma.product.delete({ where: { id } });
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error: any) {
    console.error('Failed to delete product:', error);
    res.status(500).json({
      error: 'Failed to delete product',
      message: error.message,
    });
  }
});

export default router;


