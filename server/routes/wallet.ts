import { Router } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import { isPawapayConfigured, pawapayInitiatePaymentPage, getPawapayCountry } from '../lib/pawapay';
import { getPawapayReturnUrlFor } from '../lib/pawapayReturn';
import {
  cancelPendingWalletTopUpsForUser,
  mwkToUsdForWalletTopUp,
  roundUsd,
  usdToMwkAtRate,
  usdToMwkForWalletTopUp,
  WALLET_TOPUP_MAX_USD,
  WALLET_TOPUP_MIN_USD,
} from '../lib/wallet';
import { getStoreWalletMwkPerUsd } from '../lib/storeWallet';
import { fulfillPawapayDeposit } from '../lib/pawapayFulfillment';

const router = Router();

function normEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function resolveUserByEmail(emailRaw: string) {
  const email = normEmail(emailRaw);
  if (!email) return null;
  return prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true, name: true, walletBalanceUsd: true },
  });
}

/** Balance + recent Wallet activity */
router.get('/', async (req, res) => {
  try {
    const email = typeof req.query.email === 'string' ? req.query.email.trim() : '';
    if (!email) return res.status(400).json({ error: 'email required' });

    const user = await resolveUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const transactions = await prisma.walletTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    const pendingTopUp = await prisma.walletTopUp.findFirst({
      where: { userId: user.id, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });

    const walletRateMwkPerUsd = await getStoreWalletMwkPerUsd();
    const balanceUsd = roundUsd(user.walletBalanceUsd || 0);

    return res.json({
      balanceUsd,
      balanceMwk: usdToMwkAtRate(balanceUsd, walletRateMwkPerUsd),
      walletRateMwkPerUsd,
      transactions,
      pendingTopUp: pendingTopUp
        ? {
            id: pendingTopUp.id,
            amountUsd: pendingTopUp.amountUsd,
            amountMwk: pendingTopUp.amountMwk,
            createdAt: pendingTopUp.createdAt,
          }
        : null,
    });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to load wallet' });
  }
});

/** Start PawaPay deposit to add USD to Wallet */
router.post('/topup/initiate', async (req, res) => {
  try {
    if (!isPawapayConfigured()) {
      return res.status(503).json({
        error: 'Mobile money top-up is temporarily unavailable. Please try again later.',
      });
    }

    const email = String(req.body?.email || '').trim();
    const rawMwk = req.body?.amountMwk;
    const rawUsd = req.body?.amountUsd;
    let amountUsd: number;
    let amountMwk: number;

    if (rawMwk != null && rawMwk !== '') {
      amountMwk = Math.max(1, Math.round(Number(rawMwk)));
      if (!Number.isFinite(amountMwk)) {
        return res.status(400).json({ error: 'Enter a valid MWK amount' });
      }
      amountUsd = await mwkToUsdForWalletTopUp(amountMwk);
    } else {
      amountUsd = roundUsd(Number(rawUsd));
      if (!Number.isFinite(amountUsd)) {
        return res.status(400).json({ error: 'Enter a valid amount' });
      }
      amountMwk = await usdToMwkForWalletTopUp(amountUsd);
    }

    if (!email) return res.status(400).json({ error: 'email required' });
    if (amountUsd < WALLET_TOPUP_MIN_USD) {
      const minMwk = await usdToMwkForWalletTopUp(WALLET_TOPUP_MIN_USD);
      return res.status(400).json({ error: `Minimum top-up is MWK ${minMwk.toLocaleString()} (about $${WALLET_TOPUP_MIN_USD})` });
    }
    if (amountUsd > WALLET_TOPUP_MAX_USD) {
      const maxMwk = await usdToMwkForWalletTopUp(WALLET_TOPUP_MAX_USD);
      return res.status(400).json({ error: `Maximum top-up is MWK ${maxMwk.toLocaleString()} (about $${WALLET_TOPUP_MAX_USD})` });
    }

    const user = await resolveUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found. Sign in first.' });

    await cancelPendingWalletTopUpsForUser(user.id);

    const depositId = randomUUID();
    const returnCfg = getPawapayReturnUrlFor('wallet');
    if (!returnCfg.url) {
      return res.status(503).json({
        error: returnCfg.error || 'Wallet return URL is not configured.',
      });
    }

    const started = await pawapayInitiatePaymentPage({
      depositId,
      returnUrl: returnCfg.url,
      amountMwk,
      reason: `TConnect Wallet top-up $${amountUsd.toFixed(2)}`,
      country: getPawapayCountry(),
    });

    if (!started.ok || !started.redirectUrl) {
      return res.status(400).json({
        error: started.message || 'Could not start mobile money payment.',
      });
    }

    await prisma.walletTopUp.create({
      data: {
        userId: user.id,
        depositId,
        amountUsd,
        amountMwk,
        status: 'pending',
      },
    });

    return res.json({
      redirectUrl: started.redirectUrl,
      depositId,
      amountUsd,
      amountMwk,
    });
  } catch (e: unknown) {
    console.error('[wallet] topup initiate', e);
    return res.status(500).json({ error: 'Could not start wallet top-up' });
  }
});

/** After return from PawaPay — credit Wallet if paid */
router.get('/topup/verify', async (req, res) => {
  try {
    const depositId = String(req.query.depositId || '').trim();
    if (!depositId) return res.status(400).json({ error: 'depositId required' });

    const result = await fulfillPawapayDeposit(depositId);
    if (!result.ok) {
      return res.status(400).json({
        error: result.userMessage || 'Payment could not be verified.',
        reason: result.reason,
      });
    }
    return res.json({
      ok: true,
      kind: result.kind,
      walletCreditedUsd: result.walletCreditedUsd,
      orderId: result.orderId,
    });
  } catch (e: unknown) {
    console.error('[wallet] topup verify', e);
    return res.status(500).json({ error: 'Verification failed' });
  }
});

export default router;
