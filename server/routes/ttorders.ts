import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { basicAdminAuth } from '../lib/adminAuth';

const router = Router();

// Create TT order (public - customers can submit)
router.post('/', async (req: any, res) => {
  try {
    const { customerName, email, phone, orderType, amount, currency, details } = req.body;
    
    if (!customerName || !email || !orderType || !details) {
      return res.status(400).json({ error: 'Customer name, email, order type, and details are required' });
    }
    
    const ttOrder = await prisma.tTOrder.create({
      data: {
        customerName,
        email,
        phone: phone || null,
        orderType,
        amount: amount ? parseFloat(amount) : null,
        currency: currency || null,
        details,
        status: 'pending'
      }
    });
    
    res.json(ttOrder);
  } catch (error: any) {
    console.error('Error creating TT order:', error);
    res.status(500).json({ error: error.message || 'Failed to create TT order' });
  }
});

// Get all TT orders (Admin only)
router.get('/', basicAdminAuth, async (_req: any, res) => {
  try {
    console.log('📦 [TTOrders] Fetching all TT orders...');
    const orders = await prisma.tTOrder.findMany({ orderBy: { createdAt: 'desc' } });
    console.log(`✅ [TTOrders] Found ${orders.length} TT orders`);
    res.json(orders);
  } catch (error: any) {
    console.error('❌ [TTOrders] Error fetching TT orders:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch TT orders' });
  }
});

// Update TT order status (Admin only)
router.patch('/:id/status', basicAdminAuth, async (req: any, res) => {
  try {
    const { status } = req.body;
    const order = await prisma.tTOrder.update({
      where: { id: req.params.id },
      data: { status }
    });
    res.json(order);
  } catch (error: any) {
    console.error('Error updating TT order:', error);
    res.status(500).json({ error: error.message || 'Failed to update TT order' });
  }
});

// Delete TT order (Admin only)
router.delete('/:id', basicAdminAuth, async (req: any, res) => {
  try {
    await prisma.tTOrder.delete({ where: { id: req.params.id } });
    res.json({ message: 'TT order deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting TT order:', error);
    res.status(500).json({ error: error.message || 'Failed to delete TT order' });
  }
});

export default router;

