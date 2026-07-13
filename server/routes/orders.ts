import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../lib/auth';
import { basicAdminAuth } from '../lib/adminAuth';
import {
  sendAdminOrderAlertEmail,
  sendOrderApprovedEmail,
  sendOrderRejectedEmail,
  sendOrderFulfilledEmail,
} from '../lib/email';
import { pointsRedemptionBlockReason } from '../lib/tconnectPoints';
import { getUserLifetimePurchaseUsd } from '../lib/pointsEligibility';
import { roundUsd } from '../lib/wallet';
import { walletCheckoutChargeUsd } from '../lib/storeWallet';
import { createUserNotification } from '../lib/userNotifications';
import {
  PAYCHANGU_CHECKOUT_ENABLED,
  PAWAPAY_CHECKOUT_ENABLED,
  WALLET_CHECKOUT_ENABLED,
  MOBILE_MONEY_MAX_CHECKOUT_USD,
  CHECKOUT_UNAVAILABLE_MOBILE_MONEY,
  CHECKOUT_UNAVAILABLE_WALLET,
  isMobileMoneyPaymentMethod,
} from '../lib/checkoutFlags';
import {
  utilityBillChargeFromMetadata,
  utilityBillChargeMwk,
} from '../lib/utilityBillFees';
import { getStoreWalletMwkPerUsd } from '../lib/storeWallet';
import {
  orderHasVirtualCardItems,
  provisionVirtualCardsForOrder,
} from '../lib/virtualCardProvisioning';

const router = Router();
const VIRTUAL_CARD_MIN_CHECKOUT_USD = 5;

async function clearSavedCartSnapshotForUser(userId: string | null | undefined) {
  if (!userId) return;
  try {
    await prisma.userCartSnapshot.deleteMany({ where: { userId } });
  } catch (e: unknown) {
    console.warn('[orders] Saved cart snapshot not cleared:', e instanceof Error ? e.message : e);
  }
}

// Create order with items and optional payment submission (auth optional for now)
// Card payments: agent creates the order manually in admin after customer pays and sends POP in live chat
router.post('/', async (req: any, res) => {
  try {
    const {
      items,
      totalUsd,
      totalMwk,
      payment,
      userId,
      userEmail,
      prismaUserId,
      pointsUsed,
      paymentMethod,
      pointsReceiptUrl,
      pointsReceiptId,
      adminCreateForUser,
      cartSubtotalUsd,
    } = req.body;

    // Admin: create order for a specific user (same path POST /orders to avoid 404 routing issues)
    if (adminCreateForUser === true && (userId || userEmail)) {
      const adminAuth = (req: any) => {
        const xAdminPass = req.headers['x-admin-password'];
        const authHeader = req.headers.authorization || '';
        const ADMIN_PASS = process.env.ADMIN_PASS || '09090808pP#';
        if (xAdminPass === ADMIN_PASS) return true;
        if (typeof authHeader === 'string' && authHeader.startsWith('Basic ')) {
          try {
            const decoded = Buffer.from(authHeader.replace('Basic ', ''), 'base64').toString('utf8');
            if (decoded === ADMIN_PASS) return true;
          } catch (_) {}
        }
        return false;
      };
      if (!adminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
      if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'At least one item is required' });
      const numUsd = Number(totalUsd);
      const numMwk = Number(totalMwk);
      if (!Number.isFinite(numUsd) || numUsd <= 0 || !Number.isFinite(numMwk) || numMwk <= 0) {
        return res.status(400).json({ error: 'Valid totalUsd and totalMwk are required' });
      }
      let targetUserId: string;
      if (userId) {
        const u = await prisma.user.findUnique({ where: { id: userId } });
        if (!u) return res.status(404).json({ error: 'User not found' });
        targetUserId = u.id;
      } else {
        const email = String(userEmail).trim();
        const users = await prisma.user.findMany({ where: { email: { equals: email, mode: 'insensitive' } }, take: 1 });
        const u = users[0] ?? null;
        if (!u) return res.status(404).json({ error: 'User not found for that email' });
        targetUserId = u.id;
      }
      const order = await prisma.order.create({
        data: {
          userId: targetUserId,
          status: 'pending',
          totalUsd: numUsd,
          totalMwk: Math.round(numMwk),
          items: {
            create: items.map((i: any) => ({
              name: String(i.name || 'Item').trim() || 'Item',
              type: String(i.type || 'other'),
              category: String(i.category || 'general'),
              image: i.image != null ? String(i.image) : null,
              priceUsd: Number(i.price) || 0,
              quantity: Math.max(1, Math.round(Number(i.quantity) || 1)),
              metadata: i.metadata != null ? JSON.stringify(i.metadata) : null
            }))
          }
        },
        include: { items: true, payment: true, user: true }
      });
      console.log('✅ [Orders] Manual order created for user:', { orderId: order.id, userId: targetUserId, userEmail: order.user?.email });
      await clearSavedCartSnapshotForUser(targetUserId);
      try {
        await provisionVirtualCardsForOrder(order.id);
      } catch (e: unknown) {
        console.warn('[orders] Virtual card provision (manual):', e instanceof Error ? e.message : e);
      }
      return res.json(order);
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items' });
    }
    const hasVirtualCardItem = items.some(
      (i: any) => String(i?.type || '').trim().toLowerCase() === 'virtual-card'
    );
    const hasUnderMinVirtualCard = items.some(
      (i: any) =>
        String(i?.type || '').trim().toLowerCase() === 'virtual-card' &&
        Number(i?.price) < VIRTUAL_CARD_MIN_CHECKOUT_USD
    );
    if (hasUnderMinVirtualCard) {
      return res.status(400).json({
        error: `Virtual card amount must be at least $${VIRTUAL_CARD_MIN_CHECKOUT_USD.toFixed(2)} per item.`,
      });
    }
    if (paymentMethod === 'paychangu' && !PAYCHANGU_CHECKOUT_ENABLED) {
      return res.status(503).json({ error: CHECKOUT_UNAVAILABLE_MOBILE_MONEY });
    }
    if (paymentMethod === 'pawapay' && !PAWAPAY_CHECKOUT_ENABLED) {
      return res.status(503).json({ error: CHECKOUT_UNAVAILABLE_MOBILE_MONEY });
    }
    if (paymentMethod === 'wallet' && !WALLET_CHECKOUT_ENABLED) {
      return res.status(503).json({ error: CHECKOUT_UNAVAILABLE_WALLET });
    }
    if (isMobileMoneyPaymentMethod(paymentMethod) && Number(totalUsd) > MOBILE_MONEY_MAX_CHECKOUT_USD) {
      return res.status(400).json({
        error: `Mobile money checkout is currently limited to $${MOBILE_MONEY_MAX_CHECKOUT_USD.toFixed(2)} max per order.`,
      });
    }
    const hasUtilityBillItem = items.some(
      (i: any) => String(i?.type || '').trim().toLowerCase() === 'utility-bill'
    );
    const allUtilityBillItems = items.every(
      (i: any) => String(i?.type || '').trim().toLowerCase() === 'utility-bill'
    );
    if (hasUtilityBillItem && !allUtilityBillItems) {
      return res.status(400).json({
        error: 'Utility bills must be paid on their own. Remove other items from your cart.',
      });
    }
    if (hasUtilityBillItem && paymentMethod !== 'paychangu') {
      return res.status(400).json({
        error: 'Utility bills can only be paid with mobile money.',
      });
    }
    if (hasUtilityBillItem) {
      const mwkPerUsd = await getStoreWalletMwkPerUsd();
      let expectedMwk = 0;
      let expectedUsd = 0;
      for (const i of items) {
        const meta = (i?.metadata && typeof i.metadata === 'object' ? i.metadata : {}) as Record<
          string,
          unknown
        >;
        const billMwk = Math.round(Number(meta.amountMwk) || 0);
        if (!billMwk) {
          return res.status(400).json({ error: 'Utility bill amount is required.' });
        }
        const { serviceFeeMwk, totalChargeMwk } = utilityBillChargeFromMetadata(meta);
        if (
          meta.serviceFeeMwk != null &&
          Math.abs(Math.round(Number(meta.serviceFeeMwk)) - serviceFeeMwk) > 1
        ) {
          return res.status(400).json({ error: 'Invalid utility bill service fee.' });
        }
        if (
          meta.totalChargeMwk != null &&
          Math.abs(Math.round(Number(meta.totalChargeMwk)) - totalChargeMwk) > 1
        ) {
          return res.status(400).json({ error: 'Invalid utility bill total.' });
        }
        const qty = Math.max(1, Math.round(Number(i?.quantity) || 1));
        expectedMwk += utilityBillChargeMwk(billMwk) * qty;
        expectedUsd += roundUsd(utilityBillChargeMwk(billMwk) / mwkPerUsd) * qty;
      }
      const submittedMwk = Math.round(Number(totalMwk));
      const submittedUsd = roundUsd(Number(totalUsd));
      if (Math.abs(submittedMwk - expectedMwk) > 2) {
        return res.status(400).json({ error: 'Utility bill total does not match.' });
      }
      if (Math.abs(submittedUsd - expectedUsd) > 0.05) {
        return res.status(400).json({ error: 'Utility bill total does not match.' });
      }
    }
    let finalUserId: string | undefined =
      typeof req.user?.id === 'string' ? req.user.id : undefined;
    const emailTrim =
      typeof userEmail === 'string' && userEmail.trim() ? userEmail.trim() : '';
    const clientDbId =
      typeof prismaUserId === 'string' && prismaUserId.trim()
        ? prismaUserId.trim()
        : '';

    if (!finalUserId && clientDbId && emailTrim) {
      const verified = await prisma.user.findFirst({
        where: {
          id: clientDbId,
          email: { equals: emailTrim, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (verified) finalUserId = verified.id;
    }

    if (!finalUserId && emailTrim) {
      const existing = await prisma.user.findFirst({
        where: { email: { equals: emailTrim, mode: 'insensitive' } },
        select: { id: true },
      });
      if (existing) finalUserId = existing.id;
    }
    
    // For points payment: need balance, lifetime purchases, and enough points for this order
    if (paymentMethod === 'points' && pointsUsed && pointsUsed > 0 && finalUserId) {
      const user = await prisma.user.findUnique({ where: { id: finalUserId } });
      const balance = user?.pointsBalance || 0;
      const lifetimePurchaseUsd = await getUserLifetimePurchaseUsd(finalUserId);
      const blockReason = pointsRedemptionBlockReason(balance, lifetimePurchaseUsd);
      if (!user || blockReason) {
        return res.status(400).json({
          error: blockReason || 'Points checkout is not available for this account.',
        });
      }
      if (balance < pointsUsed) {
        return res.status(400).json({ error: 'Insufficient points for this order total.' });
      }
      console.log(`✅ Points payment validated: ${pointsUsed} points available for user ${finalUserId}`);
    }

    const walletSubtotalUsd =
      paymentMethod === 'wallet' ? roundUsd(Number(cartSubtotalUsd ?? totalUsd)) : 0;
    const walletChargeUsd =
      paymentMethod === 'wallet' ? walletCheckoutChargeUsd(walletSubtotalUsd) : 0;

    if (paymentMethod === 'wallet' && finalUserId) {
      const submitted = roundUsd(Number(totalUsd));
      if (Math.abs(submitted - walletChargeUsd) > 0.02) {
        return res.status(400).json({ error: 'Wallet checkout total mismatch. Refresh and try again.' });
      }
      const walletUser = await prisma.user.findUnique({
        where: { id: finalUserId },
        select: { walletBalanceUsd: true, name: true, email: true },
      });
      const balance = walletUser?.walletBalanceUsd || 0;
      if (!walletUser || balance < walletChargeUsd - 0.001) {
        return res.status(400).json({
          error: `Insufficient Wallet balance. You have $${balance.toFixed(2)}, checkout needs $${walletChargeUsd.toFixed(2)} (includes 5% fee).`,
        });
      }
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
    } else if (paymentMethod === 'paypal' && payment) {
      paymentData = {
        create: {
          method: 'paypal',
          bankName: 'PayPal',
          accountName: payment.accountName || 'PayPal Account',
          accountNumber: null,
          transactionId: payment.transactionId || null,
          popUrl: null,
          senderName: payment.senderName || userEmail || 'PayPal User',
        }
      };
    } else if (paymentMethod === 'wallet') {
      paymentData = {
        create: {
          method: 'wallet',
          bankName: 'Wallet',
          accountName: 'TConnect Wallet',
          accountNumber: null,
          transactionId: `WALLET-${Date.now()}`,
          popUrl: null,
          senderName: payment?.senderName || userEmail || 'Customer',
        },
      };
    }
    // paymentMethod === 'card' → no payment row yet (manual link).
    // Mobile money → order stays hidden from admin until payment completes.
    const orderStatus = isMobileMoneyPaymentMethod(paymentMethod) ? 'awaiting_pawapay' : 'pending';

    if (paymentMethod === 'wallet' && finalUserId) {
      const walletUserId = finalUserId;
      const total = walletChargeUsd;
      let order;
      try {
        order = await prisma.$transaction(async (tx) => {
        const u = await tx.user.findUnique({
          where: { id: walletUserId },
          select: { walletBalanceUsd: true },
        });
        if (!u || (u.walletBalanceUsd || 0) < total - 0.001) {
          const err = new Error('INSUFFICIENT_WALLET');
          throw err;
        }
        await tx.user.update({
          where: { id: walletUserId },
          data: { walletBalanceUsd: { decrement: total } },
        });
        const created = await tx.order.create({
          data: {
            userId: walletUserId,
            status: 'pending',
            totalUsd: total,
            totalMwk: Math.round(Number(totalMwk) || 0),
            items: {
              create: items.map((i: any) => ({
                name: i.name,
                type: i.type,
                category: i.category,
                image: i.image,
                priceUsd: i.price,
                quantity: i.quantity,
                metadata: i.metadata ? JSON.stringify(i.metadata) : null,
              })),
            },
            payment: paymentData,
          },
          include: { items: true, payment: true },
        });
        await tx.walletTransaction.create({
          data: {
            userId: walletUserId,
            type: 'order_payment',
            amountUsd: -total,
            orderId: created.id,
            description: `Checkout order #${created.id.slice(0, 8)}`,
          },
        });
        return created;
      });
      } catch (e: unknown) {
        if (e instanceof Error && e.message === 'INSUFFICIENT_WALLET') {
          return res.status(400).json({ error: 'Insufficient Wallet balance' });
        }
        throw e;
      }

      await clearSavedCartSnapshotForUser(order.userId);
      try {
        await prisma.notification.create({
          data: {
            userId: null,
            type: 'order_created',
            title: 'New Order Received',
            message: `New order #${order.id.substring(0, 8)} paid with Wallet — $${order.totalUsd.toFixed(2)}`,
            link: `/admin?tab=orders&orderId=${order.id}`,
          },
        });
        await sendAdminOrderAlertEmail({
          orderId: order.id,
          totalUsd: order.totalUsd,
          totalMwk: order.totalMwk,
          itemsCount: order.items.length,
          paymentMethod: 'wallet',
        });
        if (order.userId) {
          const hasVirtual = orderHasVirtualCardItems(order.items);
          await createUserNotification({
            userId: order.userId,
            type: 'order_received',
            title: 'Order received',
            message: hasVirtual
              ? `We received your virtual card order #${order.id.substring(0, 8)} ($${order.totalUsd.toFixed(2)}). View it in My Cards on your profile.`
              : `We received your order #${order.id.substring(0, 8)} ($${order.totalUsd.toFixed(2)}). We will review it shortly.`,
            link: hasVirtual ? '/profile#my-cards' : '/orders',
          });
        }
      } catch {
        /* ignore */
      }
      console.log('Order created (wallet):', order.id);
      try {
        await provisionVirtualCardsForOrder(order.id);
      } catch (e: unknown) {
        console.warn('[orders] Virtual card provision:', e instanceof Error ? e.message : e);
      }
      return res.json(order);
    }

    const order = await prisma.order.create({
      data: {
        userId: finalUserId || (await prisma.user.upsert({ where: { email: userEmail || 'guest@unknown.local' }, update: {}, create: { email: userEmail || `guest+${Date.now()}@unknown.local`, name: 'Guest', password: '' } })).id,
        status: orderStatus,
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

    if (!isMobileMoneyPaymentMethod(paymentMethod)) {
      await clearSavedCartSnapshotForUser(order.userId);
    }

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
    
    // Notify admin only for real submissions (not unpaid mobile money checkouts)
    if (!isMobileMoneyPaymentMethod(paymentMethod)) {
      try {
        await prisma.notification.create({
          data: {
            userId: null,
            type: 'order_created',
            title: 'New Order Received',
            message: `New order #${order.id.substring(0, 8)} for $${order.totalUsd.toFixed(2)} (${order.items.length} item${order.items.length > 1 ? 's' : ''})`,
            link: `/admin?tab=orders&orderId=${order.id}`,
          },
        });
        console.log('✅ Notification created for admin');
        await sendAdminOrderAlertEmail({
          orderId: order.id,
          totalUsd: order.totalUsd,
          totalMwk: order.totalMwk,
          itemsCount: order.items.length,
          paymentMethod: paymentMethod || 'unknown',
        });
        if (order.userId) {
          const hasVirtual = orderHasVirtualCardItems(order.items);
          await createUserNotification({
            userId: order.userId,
            type: 'order_received',
            title: 'Order received',
            message: hasVirtual
              ? `We received your virtual card order #${order.id.substring(0, 8)} ($${order.totalUsd.toFixed(2)}). View it in My Cards on your profile.`
              : `We received your order #${order.id.substring(0, 8)} ($${order.totalUsd.toFixed(2)}). We will review it shortly.`,
            link: hasVirtual ? '/profile#my-cards' : '/orders',
          });
        }
      } catch (notifError: any) {
        console.error('❌ Failed to create notification:', notifError?.message || notifError);
      }
    }
    
    console.log('Order created:', order.id, 'Status:', order.status, 'Payment Method:', paymentMethod);
    try {
      await provisionVirtualCardsForOrder(order.id);
    } catch (e: unknown) {
      console.warn('[orders] Virtual card provision:', e instanceof Error ? e.message : e);
    }
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
    
    const email = String(req.query.email).trim();
    if (!email) return res.json([]);
    console.log('📦 [Orders] Fetching orders for email:', email);
    
    // Case-insensitive: find ALL users with this email (handles duplicate rows from different casing)
    const users = await prisma.user.findMany({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true }
    });
    const userIds = users.map((u: { id: string }) => u.id);
    if (userIds.length === 0) {
      console.log('⚠️ [Orders] User not found for email:', email, '- ask user to sign out and sign back in');
      return res.status(200).json({ orders: [], userNotFound: true });
    }
    if (userIds.length > 1) {
      console.log('⚠️ [Orders] Multiple users for same email (merge recommended):', email, 'ids:', userIds);
    }
    
    const orders = await prisma.order.findMany({ 
      where: {
        userId: { in: userIds },
        status: { notIn: ['awaiting_pawapay', 'cancelled'] },
      },
      include: { 
        items: {
          orderBy: { id: 'asc' }
        }, 
        payment: true 
      }, 
      orderBy: { createdAt: 'desc' } 
    });

    const EXPIRY_HOURS = 1;
    const ordersWithExpiry = orders.map((o: any) => {
      const createdAt = new Date(o.createdAt).getTime();
      const expiresAt = createdAt + EXPIRY_HOURS * 60 * 60 * 1000;
      const isExpired = o.status === 'pending' && Date.now() > expiresAt;
      return { ...o, expiresAt: new Date(expiresAt).toISOString(), isExpired };
    });
    
    console.log('✅ [Orders] Found', orders.length, 'orders for user:', email, 'userIds:', userIds);
    res.json(Array.isArray(ordersWithExpiry) ? ordersWithExpiry : []);
  } catch (error: any) {
    console.error('❌ [Orders] Error fetching user orders:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch orders' });
  }
});

// Submit proof of payment for an existing card order (explicit path – must be before /:id)
router.post('/submit-payment/:orderId', async (req: any, res) => {
  try {
    const orderId = req.params.orderId;
    const { method, transactionId, popUrl, senderName } = req.body;
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true }
    });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (order.payment) {
      return res.status(400).json({ error: 'Order already has payment submission' });
    }
    if (method !== 'card') {
      return res.status(400).json({ error: 'Expected method: card' });
    }
    const name = (senderName && String(senderName).trim()) ? String(senderName).trim() : 'Customer';
    await prisma.paymentSubmission.create({
      data: {
        orderId,
        method: 'card',
        bankName: 'Card Payment',
        accountName: 'Card',
        accountNumber: null,
        transactionId: transactionId != null ? String(transactionId) : null,
        popUrl: popUrl != null && String(popUrl).trim() ? String(popUrl).trim() : null,
        senderName: name
      }
    });
    res.json({ ok: true });
  } catch (e: any) {
    console.error('Submit payment error:', e);
    res.status(500).json({ error: e.message || 'Failed to submit payment' });
  }
});

// Get single order by id (e.g. for card-chat to read totalUsd when choosing currency)
router.get('/:id', async (req: any, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true, payment: true }
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to fetch order' });
  }
});

// Update card order totalUsd when customer chooses USD (18% fee) – only if order has no payment yet
router.patch('/:id/card-currency', async (req: any, res) => {
  try {
    const orderId = req.params.id;
    const { totalUsd } = req.body;
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true }
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.payment) return res.status(400).json({ error: 'Order already has payment' });
    if (typeof totalUsd !== 'number' || totalUsd <= 0) return res.status(400).json({ error: 'Invalid totalUsd' });
    await prisma.order.update({
      where: { id: orderId },
      data: { totalUsd }
    });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to update' });
  }
});

// Admin: list all and update status
router.get('/', basicAdminAuth, async (_req: any, res) => {
  const orders = await prisma.order.findMany({
    include: {
      items: true,
      payment: true,
      user: { select: { id: true, email: true, name: true, phone: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
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

    const transitionedTo = (target: string) => currentOrder.status !== target && status === target;

    const orderItemsForNotify = await prisma.orderItem.findMany({ where: { orderId } });
    const hasVirtualCardOrder = orderHasVirtualCardItems(orderItemsForNotify);

    // One in-app notification per transition (approved / rejected / fulfilled)
    if (
      currentOrder.userId &&
      (transitionedTo('approved') || transitionedTo('rejected') || transitionedTo('fulfilled'))
    ) {
      try {
        const shortId = orderId.substring(0, 8);
        const payload =
          status === 'approved'
            ? {
                type: 'order_confirmed',
                title: 'Order confirmed',
                message: hasVirtualCardOrder
                  ? `Your virtual card order #${shortId} is approved. Open My Cards on your profile to view your card.`
                  : `Your order #${shortId} has been approved and is being processed.`,
                link: hasVirtualCardOrder ? '/profile#my-cards' : '/orders',
              }
            : status === 'rejected'
              ? {
                  type: 'order_rejected',
                  title: 'Order rejected',
                  message: `Your order #${shortId} was rejected. Contact support if you need help.`,
                  link: '/orders',
                }
              : {
                  type: 'order_fulfilled',
                  title: 'Virtual card ready' as string,
                  message: hasVirtualCardOrder
                  ? `Your virtual card order #${shortId} is complete. Open My Cards to view your card balance and transactions.`
                  : `Your order #${shortId} is complete — open Order History for codes and details.`,
                link: hasVirtualCardOrder ? '/profile#my-cards' : '/orders',
              };
        if (!hasVirtualCardOrder && status === 'fulfilled') {
          payload.title = 'Order delivered';
        } else if (hasVirtualCardOrder && status === 'fulfilled') {
          payload.title = 'Your virtual card is ready';
        }
        await createUserNotification({
          userId: currentOrder.userId,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          link: payload.link,
        });
        console.log('✅ Notification created for user (order status change)');
      } catch (notifError: any) {
        console.error('❌ Failed to create notification:', notifError?.message || notifError);
      }
    }

    if (
      transitionedTo('approved') ||
      transitionedTo('fulfilled') ||
      status === 'approved' ||
      status === 'fulfilled'
    ) {
      try {
        await provisionVirtualCardsForOrder(orderId, {
          activate: status === 'fulfilled' || status === 'approved',
        });
      } catch (e: unknown) {
        console.warn('[orders] Virtual card provision on status:', e instanceof Error ? e.message : e);
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

    const parentOrder = await prisma.order.findFirst({
      where: { id: orderItem.orderId },
      select: { id: true },
    });
    if (parentOrder) {
      try {
        await provisionVirtualCardsForOrder(parentOrder.id, { activate: true });
      } catch (e: unknown) {
        console.warn('[orders] Virtual card provision on codes:', e instanceof Error ? e.message : e);
      }
    }

    res.json(orderItem);
  } catch (error: any) {
    console.error('Failed to update codes:', error);
    res.status(500).json({ error: error.message || 'Failed to update codes' });
  }
});

// Admin: Merge keys into OrderItem.metadata (crypto/wallet line fulfillment, notes, etc.)
router.patch('/:id/items/:itemId/metadata', basicAdminAuth, async (req: any, res) => {
  try {
    const orderId = req.params.id;
    const itemId = req.params.itemId;
    const merge = req.body?.merge;
    if (!merge || typeof merge !== 'object' || Array.isArray(merge)) {
      return res.status(400).json({ error: 'merge (object) is required' });
    }

    const item = await prisma.orderItem.findFirst({
      where: { id: itemId, orderId },
    });
    if (!item) {
      return res.status(404).json({ error: 'Order item not found for this order' });
    }

    let meta: Record<string, unknown> = {};
    if (item.metadata) {
      try {
        meta = JSON.parse(item.metadata) as Record<string, unknown>;
        if (!meta || typeof meta !== 'object' || Array.isArray(meta)) meta = {};
      } catch {
        meta = {};
      }
    }
    const next = { ...meta, ...merge };

    const orderItem = await prisma.orderItem.update({
      where: { id: itemId },
      data: { metadata: JSON.stringify(next) },
    });
    res.json(orderItem);
  } catch (error: any) {
    console.error('Failed to merge order item metadata:', error);
    res.status(500).json({ error: error.message || 'Failed to update metadata' });
  }
});

export default router;

