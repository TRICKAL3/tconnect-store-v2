import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../lib/auth';
import { basicAdminAuth } from '../lib/adminAuth';

const router = Router();

// Create order with items and optional payment submission (auth optional for now)
router.post('/', async (req: any, res) => {
  try {
    const { items, totalUsd, totalMwk, payment, userId, userEmail, pointsUsed } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items' });
    }
    let finalUserId = req.user?.id;
    if (!finalUserId && userEmail) {
      const existing = await prisma.user.findUnique({ where: { email: userEmail } });
      if (existing) finalUserId = existing.id;
    }
    
    // Deduct points if used
    if (pointsUsed && pointsUsed > 0 && finalUserId) {
      const user = await prisma.user.findUnique({ where: { id: finalUserId } });
      if (user && (user.pointsBalance || 0) >= pointsUsed) {
        // Deduct points
        await prisma.user.update({
          where: { id: finalUserId },
          data: {
            pointsBalance: {
              decrement: pointsUsed
            }
          }
        });
        
        // Create points transaction record
        await prisma.pointsTransaction.create({
          data: {
            userId: finalUserId,
            type: 'redeemed',
            points: -pointsUsed,
            orderId: null, // Will be set after order creation
            description: `Redeemed ${pointsUsed} points for order`
          }
        });
        
        console.log(`✅ Deducted ${pointsUsed} points from user ${finalUserId}`);
      } else {
        return res.status(400).json({ error: 'Insufficient points balance' });
      }
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
    
    // Update points transaction with order ID if points were used
    if (pointsUsed && pointsUsed > 0 && finalUserId) {
      await prisma.pointsTransaction.updateMany({
        where: {
          userId: finalUserId,
          orderId: null,
          type: 'redeemed',
          points: -pointsUsed
        },
        data: {
          orderId: order.id
        }
      });
    }
    
    console.log('Order created:', order.id, 'Status:', order.status);
    res.json(order);
  } catch (error: any) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: error.message || 'Failed to create order' });
  }
});

// Current user's orders (MUST be before /:id routes)
router.get('/me', async (req: any, res) => {
  try {
    if (!req.query.email) {
      console.log('⚠️ [Orders] /me called without email');
      return res.json([]);
    }
    
    const email = String(req.query.email);
    console.log('📦 [Orders] Fetching orders for email:', email);
    
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log('⚠️ [Orders] User not found for email:', email);
      return res.json([]);
    }
    
    const orders = await prisma.order.findMany({ 
      where: { userId: user.id }, 
      include: { 
        items: {
          orderBy: { id: 'asc' } // OrderItem doesn't have createdAt, use id instead
        }, 
        payment: true 
      }, 
      orderBy: { createdAt: 'desc' } 
    });
    
    console.log('✅ [Orders] Found', orders.length, 'orders for user:', email);
    res.json(orders);
  } catch (error: any) {
    console.error('❌ [Orders] Error fetching user orders:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch orders' });
  }
});

// Admin: list all and update status
router.get('/', basicAdminAuth, async (_req: any, res) => {
  const orders = await prisma.order.findMany({ include: { items: true, payment: true }, orderBy: { createdAt: 'desc' } });
  res.json(orders);
});

router.patch('/:id/status', basicAdminAuth, async (req: any, res) => {
  try {
    const { status } = req.body;
    const orderId = req.params.id;
    
    // Get the order first to check current status and calculate points
    const currentOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true }
    });
    
    if (!currentOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Update order status
    const order = await prisma.order.update({ 
      where: { id: orderId }, 
      data: { status } 
    });
    
    // Award points when order is approved (2 points per $10 = 0.2 points per $1)
    if (status === 'approved' && currentOrder.status !== 'approved' && currentOrder.userId) {
      const pointsToAward = Math.floor(currentOrder.totalUsd * 0.2); // 2 points per $10
      
      if (pointsToAward > 0) {
        // Update user's points balance
        await prisma.user.update({
          where: { id: currentOrder.userId },
          data: {
            pointsBalance: {
              increment: pointsToAward
            }
          }
        });
        
        // Create points transaction record
        await prisma.pointsTransaction.create({
          data: {
            userId: currentOrder.userId,
            type: 'earned',
            points: pointsToAward,
            orderId: orderId,
            description: `Earned ${pointsToAward} points from order #${orderId} ($${currentOrder.totalUsd.toFixed(2)})`
          }
        });
        
        console.log(`✅ Awarded ${pointsToAward} points to user ${currentOrder.userId} for order ${orderId}`);
      }
    }
    
    res.json(order);
  } catch (error: any) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: error.message || 'Failed to update order status' });
  }
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

