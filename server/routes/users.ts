import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { basicAdminAuth } from '../lib/adminAuth';

const router = Router();

router.get('/', basicAdminAuth, async (_req, res) => {
  const users = await prisma.user.findMany({ 
    orderBy: { createdAt: 'desc' }, 
    select: { 
      id: true, 
      email: true, 
      name: true, 
      role: true, 
      pointsBalance: true,
      avatarUrl: true,
      createdAt: true
    } 
  });
  res.json(users);
});

router.get('/profile', async (req, res) => {
  const email = req.query.email as string;
  if (!email) return res.status(400).json({ error: 'email required' });
  const user = await prisma.user.findUnique({ 
    where: { email }, 
    select: { id: true, email: true, name: true, avatarUrl: true, pointsBalance: true } 
  });
  if (!user) return res.status(404).json({ error: 'user not found' });
  res.json({ 
    id: user.id, 
    email: user.email, 
    name: user.name, 
    avatarUrl: user.avatarUrl,
    pointsBalance: user.pointsBalance || 0
  });
});

router.patch('/:id', basicAdminAuth, async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.params.id }, data: req.body });
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

router.post('/upsert', async (req, res) => {
  try {
    const { email, name, avatarUrl } = req.body || {};
    if (!email || typeof email !== 'string') {
      console.error('❌ Upsert user: email required');
      return res.status(400).json({ error: 'email required' });
    }
    const rawEmail = email.trim();
    if (!rawEmail) return res.status(400).json({ error: 'email required' });

    // Find by email case-insensitive so we never create duplicates (e.g. User@x.com vs user@x.com)
    const existing = await prisma.user.findFirst({
      where: { email: { equals: rawEmail, mode: 'insensitive' } }
    });
    let up: { id: string; email: string; name: string; avatarUrl: string | null; role: string };
    if (existing) {
      up = await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: name || undefined,
          avatarUrl: avatarUrl !== undefined ? avatarUrl : undefined
        }
      }) as typeof up;
    } else {
      // New user: store email in lowercase so Order History lookup matches
      const createEmail = rawEmail.toLowerCase();
      up = await prisma.user.create({
        data: {
          email: createEmail,
          name: (name && String(name).trim()) || 'User',
          password: null,
          avatarUrl: avatarUrl || null
        }
      }) as typeof up;
    }

    console.log('✅ User upserted successfully:', { id: up.id, email: up.email, name: up.name, role: up.role });
    res.json({ id: up.id, email: up.email, name: up.name, avatarUrl: up.avatarUrl ?? undefined, role: up.role });
  } catch (error: any) {
    console.error('❌ Error upserting user:', error?.message ?? error);
    res.status(500).json({
      error: error?.message || 'Failed to upsert user',
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
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
    const { receiptId, userId, customerName, email, points, usdValue } = req.body;
    
    if (!receiptId || !userId || !customerName || !email || !points || !usdValue) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if receipt ID already exists (prevent duplicates)
    const existing = await prisma.pointsReceipt.findUnique({
      where: { receiptId }
    });

    if (existing) {
      return res.status(400).json({ error: 'Receipt ID already exists' });
    }

    // Create receipt record
    const receipt = await prisma.pointsReceipt.create({
      data: {
        receiptId,
        userId,
        customerName,
        email,
        points,
        usdValue,
        verified: false
      }
    });

    res.json(receipt);
  } catch (error: any) {
    console.error('Error creating receipt:', error);
    res.status(500).json({ error: error.message || 'Failed to create receipt' });
  }
});

// Admin: Get all points receipts
router.get('/receipts', basicAdminAuth, async (req, res) => {
  try {
    const receipts = await prisma.pointsReceipt.findMany({
      include: {
        user: {
          select: { id: true, email: true, name: true }
        },
        order: {
          select: { id: true, status: true, totalUsd: true, createdAt: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
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
      data: { verified: verified === true }
    });
    res.json(receipt);
  } catch (error: any) {
    console.error('Error verifying receipt:', error);
    res.status(500).json({ error: error.message || 'Failed to verify receipt' });
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

    // Get current user to check balance
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if removing points and user has enough
    if (points < 0 && (user.pointsBalance || 0) < Math.abs(points)) {
      return res.status(400).json({ error: 'User does not have enough points to remove' });
    }

    // Update user points
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        pointsBalance: {
          increment: points
        }
      }
    });

    // Create points transaction record
    await prisma.pointsTransaction.create({
      data: {
        userId: userId,
        type: points > 0 ? 'earned' : 'redeemed',
        points: points,
        orderId: null,
        description: `Admin adjustment: ${reason} (${points > 0 ? '+' : ''}${points} points)`
      }
    });

    res.json({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      pointsBalance: updatedUser.pointsBalance
    });
  } catch (error: any) {
    console.error('Error adjusting points:', error);
    res.status(500).json({ error: error.message || 'Failed to adjust points' });
  }
});

export default router;

