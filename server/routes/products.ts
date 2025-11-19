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
  try {
    console.log('📦 Creating product with data:', req.body);
    const product = await prisma.product.create({ data: req.body });
    console.log('✅ Product created successfully:', product.id);
    res.json(product);
  } catch (error: any) {
    console.error('❌ Error creating product:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to create product',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.put('/:id', basicAdminAuth, async (req: any, res) => {
  const product = await prisma.product.update({ where: { id: req.params.id }, data: req.body });
  res.json(product);
});

export default router;

