import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { basicAdminAuth } from '../lib/adminAuth';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    console.log('📦 [Products] Fetching all products...');
    const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
    console.log(`✅ [Products] Found ${products.length} products`);
    res.json(products);
  } catch (error: any) {
    console.error('❌ [Products] Error fetching products:', error);
    res.status(500).json({ 
      error: 'Failed to fetch products',
      message: error.message 
    });
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
    console.error('❌ [Products] Error fetching product:', error);
    res.status(500).json({
      error: 'Failed to fetch product',
      message: error.message,
    });
  }
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

router.delete('/:id', basicAdminAuth, async (req: any, res) => {
  try {
    console.log('🗑️ [Products] Deleting product:', req.params.id);
    await prisma.product.delete({ where: { id: req.params.id } });
    console.log('✅ [Products] Product deleted successfully');
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error: any) {
    console.error('❌ [Products] Error deleting product:', error);
    res.status(500).json({ 
      error: 'Failed to delete product',
      message: error.message 
    });
  }
});

export default router;

