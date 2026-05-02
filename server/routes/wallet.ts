import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { initiateRequestToPay } from '../lib/onekhusa';

const router = Router();

// Helper: get or create wallet in MWK for a user
async function getOrCreateWallet(userId: string) {
  let wallet = await prisma.wallet.findFirst({
    where: { userId, currency: 'MWK' },
  });
  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: {
        userId,
        currency: 'MWK',
        balance: 0,
      },
    });
  }
  return wallet;
}

// Get direct top-up instructions (merchant account + reference for payment.success flow)
router.get('/direct-topup-info', async (req: any, res) => {
  try {
    const email = req.query.email as string | undefined;
    if (!email) {
      return res.status(400).json({ error: 'email query param is required' });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const merchantAccount = process.env.ONEKHUSA_MERCHANT_ACCOUNT || '';
    const reference = `WALLET-${email}`;
    res.json({
      merchantAccountNumber: merchantAccount,
      reference,
      instructions:
        'Send money to the merchant account below from your bank or mobile money. Use the reference exactly as shown so we can credit your wallet.',
    });
  } catch (error: any) {
    console.error('❌ [Wallet] direct-topup-info failed:', error);
    res.status(500).json({ error: 'Failed to get direct top-up info' });
  }
});

// Get user's wallet and recent transactions by email
router.get('/', async (req: any, res) => {
  try {
    const email = req.query.email as string | undefined;
    if (!email) {
      return res.status(400).json({ error: 'email query param is required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = user.id;

    const wallet = await getOrCreateWallet(userId);
    const transactions = await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json({
      wallet: {
        id: wallet.id,
        currency: wallet.currency,
        balanceMinor: wallet.balance,
      },
      transactions,
    });
  } catch (error: any) {
    console.error('❌ [Wallet] Failed to fetch wallet:', error);
    res.status(500).json({ error: 'Failed to fetch wallet' });
  }
});

// Initiate wallet top-up using OneKhusa Request To Pay
router.post('/topup', async (req: any, res) => {
  try {
    const { amountMwk, description, userEmail } = req.body || {};

    if (!userEmail) {
      return res.status(400).json({ error: 'userEmail is required' });
    }
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const userId = user.id;
    if (!amountMwk || typeof amountMwk !== 'number' || amountMwk <= 0) {
      return res
        .status(400)
        .json({ error: 'amountMwk must be a positive number' });
    }

    const wallet = await getOrCreateWallet(userId);

    // Create a pending wallet transaction
    const reference = `WAL-${Date.now().toString(36).toUpperCase()}`;
    const tx = await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'topup',
        amount: amountMwk,
        status: 'pending',
        externalRef: reference,
        metadata: JSON.stringify({
          description: description || 'Wallet top-up',
          userEmail,
        }),
      },
    });

    // Call OneKhusa Request To Pay
    const rtp = await initiateRequestToPay({
      amount: amountMwk,
      description:
        description || `TConnect wallet top-up (${amountMwk.toLocaleString()} MWK)`,
      referenceNumber: reference,
    });

    // Store TAN in metadata
    await prisma.walletTransaction.update({
      where: { id: tx.id },
      data: {
        metadata: JSON.stringify({
          description: description || 'Wallet top-up',
          userEmail,
          timedAccountNumber: rtp.timedAccountNumber,
          expiryDate: rtp.expiryDate,
        }),
      },
    });

    res.json({
      reference,
      timedAccountNumber: rtp.timedAccountNumber,
      expiryDate: rtp.expiryDate,
      expiryInMinutes: rtp.expiryInMinutes,
    });
  } catch (error: any) {
    console.error('❌ [Wallet] Failed to initiate top-up:', error);
    res
      .status(500)
      .json({ error: error.message || 'Failed to initiate wallet top-up' });
  }
});

// Spend from wallet balance (for orders, etc.)
router.post('/spend', async (req: any, res) => {
  try {
    const { amountMwk, reason, userEmail } = req.body || {};

    if (!userEmail) {
      return res.status(400).json({ error: 'userEmail is required' });
    }
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const userId = user.id;
    if (!amountMwk || typeof amountMwk !== 'number' || amountMwk <= 0) {
      return res
        .status(400)
        .json({ error: 'amountMwk must be a positive number' });
    }

    const wallet = await getOrCreateWallet(userId);

    if (wallet.balance < amountMwk) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    const updated = await prisma.$transaction(async (txClient) => {
      const updatedWallet = await txClient.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: amountMwk },
        },
      });

      const tx = await txClient.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'purchase',
          amount: -amountMwk,
          status: 'completed',
          metadata: JSON.stringify({ reason: reason || 'Purchase' }),
        },
      });

      return { wallet: updatedWallet, transaction: tx };
    });

    res.json({
      wallet: {
        id: updated.wallet.id,
        currency: updated.wallet.currency,
        balanceMinor: updated.wallet.balance,
      },
      transaction: updated.transaction,
    });
  } catch (error: any) {
    console.error('❌ [Wallet] Failed to spend from wallet:', error);
    res
      .status(500)
      .json({ error: error.message || 'Failed to spend from wallet' });
  }
});

export default router;

