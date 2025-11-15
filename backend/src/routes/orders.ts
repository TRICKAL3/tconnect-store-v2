import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../lib/auth';
import { basicAdminAuth } from '../lib/adminAuth';

const router = Router();

// Create order with items and optional payment submission (auth optional for now)
router.post('/', async (req: any, res) => {
  try {
    const { items, totalUsd, totalMwk, payment, userId, userEmail } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items' });
    }
    let finalUserId = req.user?.id;
    if (!finalUserId && userEmail) {
      const existing = await prisma.user.findUnique({ where: { email: userEmail } });
      if (existing) finalUserId = existing.id;
    }
    
    const order = await prisma.order.create({
      data: {
        userId: finalUserId || (await prisma.user.upsert({ where: { email: userEmail || 'guest@unknown.local' }, update: {}, create: { email: userEmail || `guest+${Date.now()}@unknown.local`, name: 'Guest', password: '' } })).id,
        status: 'pending', // Explicitly set to pending
        totalUsd,
        totalMwk,
        items: {
          create: items.map((i: any) => ({
            name: i.name,
            type: i.type,
            category: i.category,
            image: i.image,
            priceUsd: i.price,
            quantity: i.quantity,
            metadata: i.metadata ? JSON.stringify(i.metadata) : null
          }))
        },
        payment: payment
          ? {
              create: {
                bankName: payment.bankName || 'National Bank of Malawi',
                accountName: payment.accountName,
                accountNumber: payment.accountNumber || null,
                transactionId: payment.transactionId || null,
                popUrl: payment.popUrl || null,
                senderName: payment.senderName
              }
            }
          : undefined
      },
      include: { items: true, payment: true }
    });
    
    console.log('Order created:', order.id, 'Status:', order.status);
    res.json(order);
  } catch (error: any) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: error.message || 'Failed to create order' });
  }
});

// Current user's orders
router.get('/me', async (req: any, res) => {
  if (!req.query.email) return res.json([]);
  const user = await prisma.user.findUnique({ where: { email: String(req.query.email) } });
  if (!user) return res.json([]);
  const orders = await prisma.order.findMany({ where: { userId: user.id }, include: { items: true, payment: true }, orderBy: { createdAt: 'desc' } });
  res.json(orders);
});

// Admin: list all and update status
router.get('/', basicAdminAuth, async (_req: any, res) => {
  const orders = await prisma.order.findMany({ include: { items: true, payment: true }, orderBy: { createdAt: 'desc' } });
  res.json(orders);
});

router.patch('/:id/status', basicAdminAuth, async (req: any, res) => {
  const order = await prisma.order.update({ where: { id: req.params.id }, data: { status: req.body.status } });
  res.json(order);
});

// Admin: Add gift card codes to order items
router.patch('/:id/items/:itemId/codes', basicAdminAuth, async (req: any, res) => {
  try {
    const { itemId } = req.params;
    const { codes } = req.body; // Array of codes: ["CODE1", "CODE2"]
    
    if (!Array.isArray(codes)) {
      return res.status(400).json({ error: 'Codes must be an array' });
    }

    const orderItem = await prisma.orderItem.update({
      where: { id: itemId },
      data: { giftCardCodes: JSON.stringify(codes) }
    });

    res.json(orderItem);
  } catch (error: any) {
    console.error('Failed to update codes:', error);
    res.status(500).json({ error: error.message || 'Failed to update codes' });
  }
});

export default router;


