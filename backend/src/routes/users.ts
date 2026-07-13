import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { basicAdminAuth } from '../lib/adminAuth';
import { MIN_POINTS_BALANCE_FOR_CHECKOUT, pointsRedemptionBlockReason, meetsLifetimePurchaseRequirement } from '../lib/tconnectPoints';
import { getUserLifetimePurchaseUsd } from '../lib/pointsEligibility';

const router = Router();

router.get('/', basicAdminAuth, async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const sortByPoints = req.query.sort === 'points';
    const minPointsOnly = req.query.minPoints === '1' || req.query.minPoints === 'true';
    const takeRaw = Number(req.query.limit);
    const take = Number.isFinite(takeRaw)
      ? Math.min(10000, Math.max(1, Math.floor(takeRaw)))
      : search
        ? 100
        : 5000;
    const skipRaw = Number(req.query.offset);
    const skip = Number.isFinite(skipRaw) ? Math.max(0, Math.floor(skipRaw)) : 0;

    const where: Prisma.UserWhereInput = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (minPointsOnly) {
      where.pointsBalance = { gt: 0 };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: sortByPoints ? { pointsBalance: 'desc' } : { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          pointsBalance: true,
          walletBalanceUsd: true,
          avatarUrl: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.setHeader('X-Total-Count', String(total));
    return res.json(users);
  } catch (error: any) {
    console.error('Failed to load users:', error);
    return res.status(503).json({ error: error?.message || 'Users service unavailable' });
  }
});

router.get('/profile', async (req, res) => {
  const email = (req.query.email as string)?.trim();
  if (!email) return res.status(400).json({ error: 'email required' });
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true, name: true, avatarUrl: true, pointsBalance: true },
  });
  if (!user) return res.status(404).json({ error: 'user not found' });
  const lifetimePurchaseUsd = await getUserLifetimePurchaseUsd(user.id);
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    pointsBalance: user.pointsBalance ?? 0,
    lifetimePurchaseUsd,
    canRedeemPoints:
      (user.pointsBalance ?? 0) >= MIN_POINTS_BALANCE_FOR_CHECKOUT &&
      meetsLifetimePurchaseRequirement(lifetimePurchaseUsd),
  });
});

router.patch('/:id', basicAdminAuth, async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.params.id }, data: req.body });
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

router.post('/upsert', async (req, res) => {
  try {
    console.log('=== UPSERT REQUEST RECEIVED ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Request headers:', req.headers);
    
    const { email, name, avatarUrl } = req.body || {};
    if (!email) {
      console.error('❌ Upsert user: email required');
      return res.status(400).json({ error: 'email required' });
    }
    
    console.log('📝 Upserting user:', { email, name, avatarUrl });
    
    try {
      const raw = String(email).trim();
      if (!raw) {
        console.error('❌ Upsert user: blank email');
        return res.status(400).json({ error: 'email required' });
      }

      // Case-sensitive unique(email) caused duplicate Users when Firebase casing != DB casing;
      // cart sync rejects wrong userDbId and carts never persist.
      const existing = await prisma.user.findFirst({
        where: { email: { equals: raw, mode: 'insensitive' } },
      });

      let up;
      if (existing) {
        up = await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: name || undefined,
            avatarUrl: avatarUrl || undefined,
          },
        });
      } else {
        up = await prisma.user.create({
          data: {
            email: raw.toLowerCase(),
            name: name || 'User',
            password: null,
            avatarUrl,
          },
        });
      }
      
      console.log('✅ User upserted successfully:', { 
        id: up.id, 
        email: up.email, 
        name: up.name,
        role: up.role 
      });
      res.json({ id: up.id, email: up.email, name: up.name, avatarUrl: up.avatarUrl, role: up.role });
    } catch (dbError: any) {
      console.error('❌ Database error during upsert:', {
        error: dbError.message,
        code: dbError.code,
        meta: dbError.meta,
        stack: dbError.stack
      });
      throw dbError;
    }
  } catch (error: any) {
    console.error('❌ Error upserting user:', {
      error: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack
    });
    res.status(500).json({ 
      error: error.message || 'Failed to upsert user',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.delete('/:id', basicAdminAuth, async (req, res) => {
  await prisma.user.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// Create points redemption receipt (called when user generates receipt)
router.post('/receipts', async (req, res) => {
  try {
    const { receiptId, userId, customerName, email, points, usdValue } = req.body || {};

    const receiptIdVal = String(receiptId || '').trim();
    const nameVal = String(customerName || '').trim();
    const emailVal = String(email || '').trim();
    const pointsVal = Number(points);
    const usdVal = Number(usdValue);

    if (!receiptIdVal || !nameVal || !emailVal || !Number.isFinite(pointsVal) || pointsVal <= 0 || !Number.isFinite(usdVal) || usdVal <= 0) {
      return res.status(400).json({ error: 'Missing or invalid fields (receiptId, customerName, email, points, usdValue)' });
    }

    let userIdVal = String(userId || '').trim();
    if (!userIdVal) {
      const byEmail = await prisma.user.findFirst({
        where: { email: { equals: emailVal, mode: 'insensitive' } },
        select: { id: true },
      });
      if (!byEmail) return res.status(404).json({ error: 'User not found for email' });
      userIdVal = byEmail.id;
    }

    const user = await prisma.user.findUnique({
      where: { id: userIdVal },
      select: { pointsBalance: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const balance = user.pointsBalance || 0;
    const lifetimePurchaseUsd = await getUserLifetimePurchaseUsd(userIdVal);
    const blockReason = pointsRedemptionBlockReason(balance, lifetimePurchaseUsd);
    if (blockReason) {
      return res.status(400).json({ error: blockReason });
    }
    if (balance < pointsVal) {
      return res.status(400).json({ error: 'Insufficient points for this order total.' });
    }

    const existing = await prisma.pointsReceipt.findUnique({ where: { receiptId: receiptIdVal } });
    if (existing) {
      return res.status(400).json({ error: 'Receipt ID already exists' });
    }

    const receipt = await prisma.pointsReceipt.create({
      data: {
        receiptId: receiptIdVal,
        userId: userIdVal,
        customerName: nameVal,
        email: emailVal,
        points: Math.round(pointsVal),
        usdValue: Number(usdVal.toFixed(2)),
        verified: false,
      },
    });

    res.json(receipt);
  } catch (error: any) {
    console.error('Error creating receipt:', error);
    res.status(500).json({ error: error.message || 'Failed to create receipt' });
  }
});

// Admin: Get all points receipts
router.get('/receipts', basicAdminAuth, async (_req, res) => {
  try {
    let receipts: any[] = [];
    try {
      receipts = await prisma.pointsReceipt.findMany({
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
          order: {
            select: { id: true, status: true, totalUsd: true, createdAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (joinError) {
      console.warn('Receipts include join failed, falling back to base fields only:', joinError);
      receipts = await prisma.pointsReceipt.findMany({
        orderBy: { createdAt: 'desc' },
      });
    }
    res.json(receipts);
  } catch (error: any) {
    console.error('Error fetching receipts:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch receipts' });
  }
});

// Admin: Verify a receipt
router.patch('/receipts/:id/verify', basicAdminAuth, async (req, res) => {
  try {
    const { verified } = req.body;
    const receipt = await prisma.pointsReceipt.update({
      where: { id: req.params.id },
      data: { verified: verified === true },
    });
    res.json(receipt);
  } catch (error: any) {
    console.error('Error verifying receipt:', error);
    res.status(500).json({ error: error.message || 'Failed to verify receipt' });
  }
});

// Admin: Reset all user points balances to zero
router.post('/points/bulk-reset', basicAdminAuth, async (_req, res) => {
  try {
    const usersWithPoints = await prisma.user.findMany({
      where: { pointsBalance: { gt: 0 } },
      select: { id: true, pointsBalance: true },
    });

    const result = await prisma.$transaction(async (tx) => {
      const reset = await tx.user.updateMany({
        where: { pointsBalance: { gt: 0 } },
        data: { pointsBalance: 0 },
      });

      if (usersWithPoints.length > 0) {
        const rows = usersWithPoints.map((user) => ({
          userId: user.id,
          type: 'adjusted',
          points: -(user.pointsBalance || 0),
          description: 'Admin bulk reset: all balances set to zero',
        }));
        const batchSize = 500;
        for (let i = 0; i < rows.length; i += batchSize) {
          await tx.pointsTransaction.createMany({
            data: rows.slice(i, i + batchSize),
          });
        }
      }

      return reset;
    });

    res.json({
      ok: true,
      usersReset: result.count,
      totalPointsRemoved: usersWithPoints.reduce((sum, user) => sum + (user.pointsBalance || 0), 0),
    });
  } catch (error: any) {
    console.error('Error resetting all points:', error);
    res.status(500).json({ error: error.message || 'Failed to reset all points balances' });
  }
});

// Admin: Grant $1 worth of points to every user (130 pts = $1 at 1300 pts = $10)
router.post('/points/bulk-grant-dollar', basicAdminAuth, async (_req, res) => {
  try {
    const pointsToGrant = 130;
    const allUsers = await prisma.user.findMany({ select: { id: true } });

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        data: { pointsBalance: { increment: pointsToGrant } },
      });

      if (allUsers.length > 0) {
        const rows = allUsers.map((user) => ({
          userId: user.id,
          type: 'earned',
          points: pointsToGrant,
          description: `Admin bulk grant: $1 worth of points (+${pointsToGrant} pts)`,
        }));
        const batchSize = 500;
        for (let i = 0; i < rows.length; i += batchSize) {
          await tx.pointsTransaction.createMany({
            data: rows.slice(i, i + batchSize),
          });
        }
      }

      return updated;
    });

    res.json({
      ok: true,
      usersGranted: result.count,
      pointsPerUser: pointsToGrant,
      usdValuePerUser: 1,
      totalPointsGranted: result.count * pointsToGrant,
    });
  } catch (error: any) {
    console.error('Error granting $1 points to all users:', error);
    res.status(500).json({ error: error.message || 'Failed to grant points to all users' });
  }
});

// Admin: Adjust user points (add or remove)
router.post('/:id/points', basicAdminAuth, async (req, res) => {
  try {
    const { points, reason } = req.body;
    const userId = req.params.id;

    if (!points || points === 0) {
      return res.status(400).json({ error: 'Points amount is required and cannot be zero' });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Reason is required for points adjustment' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (points < 0 && (user.pointsBalance || 0) < Math.abs(points)) {
      return res.status(400).json({ error: 'User does not have enough points to remove' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        pointsBalance: {
          increment: points,
        },
      },
    });

    await prisma.pointsTransaction.create({
      data: {
        userId: userId,
        type: points > 0 ? 'earned' : 'redeemed',
        points: points,
        orderId: null,
        description: `Admin adjustment: ${reason} (${points > 0 ? '+' : ''}${points} points)`,
      },
    });

    res.json({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      pointsBalance: updatedUser.pointsBalance,
    });
  } catch (error: any) {
    console.error('Error adjusting points:', error);
    res.status(500).json({ error: error.message || 'Failed to adjust points' });
  }
});

export default router;


