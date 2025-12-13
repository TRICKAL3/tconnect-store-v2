import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../lib/auth';
import { basicAdminAuth } from '../lib/adminAuth';
import { sendOrderApprovedEmail, sendOrderRejectedEmail, sendOrderFulfilledEmail } from '../lib/email';

const router = Router();

// Create order with items and optional payment submission (auth optional for now)
router.post('/', async (req: any, res) => {
  try {
    const { items, totalUsd, totalMwk, payment, userId, userEmail, pointsUsed, paymentMethod, pointsReceiptUrl, pointsReceiptId } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items' });
    }
    let finalUserId = req.user?.id;
    if (!finalUserId && userEmail) {
      const existing = await prisma.user.findUnique({ where: { email: userEmail } });
      if (existing) finalUserId = existing.id;
    }
    
    // For points payment: validate points balance but DON'T deduct yet (wait for approval)
    if (paymentMethod === 'points' && pointsUsed && pointsUsed > 0 && finalUserId) {
      const user = await prisma.user.findUnique({ where: { id: finalUserId } });
      if (!user || (user.pointsBalance || 0) < pointsUsed) {
        return res.status(400).json({ error: 'Insufficient points balance' });
      }
      console.log(`✅ Points payment validated: ${pointsUsed} points available for user ${finalUserId}`);
    }
    
    // Create payment submission based on payment method
    let paymentData: any = undefined;
    if (paymentMethod === 'points' && pointsUsed && pointsReceiptUrl) {
      // For points payment, store points info in payment submission
      // If there's also bank payment (remainder), combine them
      const combinedPopUrl = payment?.popUrl ? `${pointsReceiptUrl}|${payment.popUrl}` : pointsReceiptUrl;
      const combinedTransactionId = payment?.transactionId ? `PTS-${pointsUsed}|BANK-${payment.transactionId}` : `PTS-${pointsUsed}`;
      
      paymentData = {
        create: {
          method: 'points', // Primary method is points
          bankName: payment?.bankName || 'TConnect Points',
          accountName: payment?.accountName || 'Points Redemption',
          accountNumber: payment?.accountNumber || null,
          transactionId: combinedTransactionId, // Store points amount and bank transaction if any
          popUrl: combinedPopUrl, // Store both receipts if applicable
          senderName: payment?.senderName || userEmail || 'Points User'
        }
      };
    } else if (paymentMethod === 'bank' && payment) {
      paymentData = {
        create: {
          method: 'bank',
          bankName: payment.bankName || 'National Bank of Malawi',
          accountName: payment.accountName,
          accountNumber: payment.accountNumber || null,
          transactionId: payment.transactionId || null,
          popUrl: payment.popUrl || null,
          senderName: payment.senderName
        }
      };
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
        payment: paymentData,
        // Link points receipt to order if provided
        pointsReceipt: pointsReceiptId ? {
          connect: { receiptId: pointsReceiptId }
        } : undefined
      },
      include: { items: true, payment: true, pointsReceipt: true }
    });
    
    // Update receipt with order ID if linked
    if (pointsReceiptId && order.id) {
      try {
        await prisma.pointsReceipt.update({
          where: { receiptId: pointsReceiptId },
          data: { orderId: order.id }
        });
        console.log(`✅ Linked receipt ${pointsReceiptId} to order ${order.id}`);
      } catch (error: any) {
        console.error(`⚠️ Failed to link receipt to order:`, error);
        // Don't fail order creation if receipt linking fails
      }
    }
    
    // Create notification for admin
    try {
      await prisma.notification.create({
        data: {
          userId: null, // null = admin notification
          type: 'order_created',
          title: 'New Order Received',
          message: `New order #${order.id.substring(0, 8)} for $${order.totalUsd.toFixed(2)} (${order.items.length} item${order.items.length > 1 ? 's' : ''})`,
          link: `/admin?tab=orders&orderId=${order.id}`
        }
      });
      console.log('✅ Notification created for admin');
    } catch (notifError: any) {
      console.error('❌ Failed to create notification:', notifError?.message || notifError);
      // Don't fail order creation if notification fails
    }
    
    console.log('Order created:', order.id, 'Status:', order.status, 'Payment Method:', paymentMethod);
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
      data: { status },
      include: { user: true }
    });
    
    // Create notification for user if order is confirmed or rejected
    if ((status === 'approved' || status === 'rejected') && currentOrder.userId) {
      try {
        await prisma.notification.create({
          data: {
            userId: currentOrder.userId,
            type: status === 'approved' ? 'order_confirmed' : 'order_rejected',
            title: status === 'approved' ? 'Order Confirmed!' : 'Order Rejected',
            message: status === 'approved' 
              ? `Your order #${orderId.substring(0, 8)} has been confirmed and is being processed.`
              : `Your order #${orderId.substring(0, 8)} has been rejected. Please contact support for details.`,
            link: `/orders`
          }
        });
        console.log('✅ Notification created for user (order status change)');
      } catch (notifError: any) {
        console.error('❌ Failed to create notification:', notifError?.message || notifError);
        // Don't fail status update if notification fails
      }
    }
    
    // Send email notification to user when order status changes
    if ((status === 'approved' || status === 'rejected' || status === 'fulfilled') && order.user && order.user.email) {
      console.log(`📧 [Email] Attempting to send ${status} email to ${order.user.email} for order ${orderId}`);
      try {
        // Get order items with gift card codes
        const orderItems = await prisma.orderItem.findMany({
          where: { orderId: orderId }
        });
        
        const emailData = {
          orderId: order.id,
          orderNumber: order.id.substring(0, 8).toUpperCase(),
          userEmail: order.user.email,
          userName: order.user.name || 'Customer',
          totalUsd: order.totalUsd,
          totalMwk: order.totalMwk,
          items: orderItems.map(item => ({
            name: item.name,
            quantity: item.quantity,
            priceUsd: item.priceUsd,
            type: item.type,
            giftCardCodes: item.giftCardCodes || undefined
          }))
        };
        
        console.log(`📧 [Email] Email data prepared:`, {
          userEmail: emailData.userEmail,
          userName: emailData.userName,
          orderNumber: emailData.orderNumber,
          itemsCount: emailData.items.length
        });
        
        if (status === 'approved') {
          await sendOrderApprovedEmail(emailData);
        } else if (status === 'rejected') {
          await sendOrderRejectedEmail(emailData);
        } else if (status === 'fulfilled') {
          await sendOrderFulfilledEmail(emailData);
        }
      } catch (emailError: any) {
        console.error('❌ [Email] Failed to send order status email:', emailError?.message || emailError);
        console.error('❌ [Email] Error details:', emailError);
        // Don't fail status update if email fails
      }
    } else {
      console.log(`⚠️ [Email] Skipping email send - Status: ${status}, User: ${order.user ? 'exists' : 'null'}, Email: ${order.user?.email || 'none'}`);
    }
    
    // Handle points: deduct if paid with points, award if paid with bank/card
    const wasAlreadyCompleted = currentOrder.status === 'approved' || currentOrder.status === 'fulfilled';
    const isNowCompleted = status === 'approved' || status === 'fulfilled';
    
    // Get payment method from payment submission
    const paymentSubmission = await prisma.paymentSubmission.findUnique({
      where: { orderId: orderId }
    });
    
    const isPointsPayment = paymentSubmission?.method === 'points';
    
    if (isNowCompleted && !wasAlreadyCompleted && currentOrder.userId) {
      if (isPointsPayment) {
        // Deduct points when order is approved (points were validated but not deducted at creation)
        const pointsToDeduct = paymentSubmission?.transactionId ? parseInt(paymentSubmission.transactionId.replace('PTS-', '')) : 0;
        
        if (pointsToDeduct > 0) {
          try {
            // Check if points were already deducted for this order
            const existingTransaction = await prisma.pointsTransaction.findFirst({
              where: {
                orderId: orderId,
                type: 'redeemed',
                points: -pointsToDeduct
              }
            });

            if (existingTransaction) {
              console.log(`⚠️ Points already deducted for order ${orderId}, skipping...`);
            } else {
              const user = await prisma.user.findUnique({ where: { id: currentOrder.userId } });
              if (user && (user.pointsBalance || 0) >= pointsToDeduct) {
                // Deduct points
                await prisma.user.update({
                  where: { id: currentOrder.userId },
                  data: {
                    pointsBalance: {
                      decrement: pointsToDeduct
                    }
                  }
                });
                
                // Create points transaction record
                await prisma.pointsTransaction.create({
                  data: {
                    userId: currentOrder.userId,
                    type: 'redeemed',
                    points: -pointsToDeduct,
                    orderId: orderId,
                    description: `Redeemed ${pointsToDeduct} points for order #${orderId} ($${currentOrder.totalUsd.toFixed(2)})`
                  }
                });
                
                console.log(`✅ Deducted ${pointsToDeduct} points from user ${currentOrder.userId} for order ${orderId}`);
              } else {
                console.error(`❌ Insufficient points balance for order ${orderId}`);
              }
            }
          } catch (error: any) {
            console.error(`❌ Error deducting points for order ${orderId}:`, error);
            // Don't fail the status update if points deduction fails
          }
        }
        // NO points earned for points-paid orders
        console.log(`ℹ️ Order ${orderId} was paid with points - no points earned`);
      } else {
        // Award points when order is approved or fulfilled (2 points per $10 = 0.2 points per $1)
        // Only for non-points payments
        const pointsToAward = Math.floor(currentOrder.totalUsd * 0.2); // 2 points per $10
        
        if (pointsToAward > 0) {
          try {
            // Check if points were already awarded for this order
            const existingTransaction = await prisma.pointsTransaction.findFirst({
              where: {
                orderId: orderId,
                type: 'earned',
                points: pointsToAward
              }
            });

            if (existingTransaction) {
              console.log(`⚠️ Points already awarded for order ${orderId}, skipping...`);
            } else {
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
              
              console.log(`✅ Awarded ${pointsToAward} points to user ${currentOrder.userId} for order ${orderId} ($${currentOrder.totalUsd})`);
            }
          } catch (error: any) {
            console.error(`❌ Error awarding points for order ${orderId}:`, error);
            // Don't fail the status update if points awarding fails
          }
        } else {
          console.log(`⚠️ Order ${orderId} total is $${currentOrder.totalUsd}, no points to award (minimum $10 for 2 points)`);
        }
      }
    } else if (isNowCompleted && wasAlreadyCompleted) {
      console.log(`⚠️ Order ${orderId} was already ${currentOrder.status}, points already processed`);
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

