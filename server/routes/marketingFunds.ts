import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { basicAdminAuth } from '../lib/adminAuth';

const router = Router();

const PAYOUT_METHODS = ['bank_transfer', 'mobile_money', 'virtual_card'] as const;

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function parseMonthKey(raw: unknown): string {
  if (typeof raw === 'string' && /^\d{4}-\d{2}$/.test(raw.trim())) return raw.trim();
  return currentMonthKey();
}

function roundUsd(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function roundMwk(amount: number): number {
  return Math.round(amount);
}

function mwkFromUsd(usd: number, rateMwk: number): number {
  return roundMwk(usd * rateMwk);
}

function usdFromMwk(mwk: number, rateMwk: number): number {
  if (rateMwk <= 0) return 0;
  return roundUsd(mwk / rateMwk);
}

type LotRow = {
  id: string;
  allocatedUsd: number;
  balanceUsdRemaining: number;
  balanceMwkRemaining: number;
  rateMwk: number;
  notes: string | null;
  createdAt: Date;
};

function formatLot(row: LotRow) {
  const allocatedUsd = roundUsd(Number(row.allocatedUsd));
  const balanceUsd = roundUsd(Number(row.balanceUsdRemaining));
  const balanceMwk = roundMwk(Number(row.balanceMwkRemaining));
  const rateMwk = Number(row.rateMwk);
  const allocatedMwk = mwkFromUsd(allocatedUsd, rateMwk);
  const spentUsd = roundUsd(allocatedUsd - balanceUsd);
  const spentMwk = roundMwk(allocatedMwk - balanceMwk);

  return {
    id: row.id,
    rateMwk,
    allocatedUsd,
    balanceUsdRemaining: balanceUsd,
    allocatedMwk,
    balanceMwkRemaining: balanceMwk,
    spentUsd,
    spentMwk,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

function formatBudgetWithLots(monthKey: string, lots: LotRow[], notes: string | null = null) {
  const formattedLots = lots.map(formatLot);
  const totals = formattedLots.reduce(
    (acc, lot) => ({
      allocatedUsd: roundUsd(acc.allocatedUsd + lot.allocatedUsd),
      balanceUsdRemaining: roundUsd(acc.balanceUsdRemaining + lot.balanceUsdRemaining),
      allocatedMwk: roundMwk(acc.allocatedMwk + lot.allocatedMwk),
      balanceMwkRemaining: roundMwk(acc.balanceMwkRemaining + lot.balanceMwkRemaining),
      spentUsd: roundUsd(acc.spentUsd + lot.spentUsd),
      spentMwk: roundMwk(acc.spentMwk + lot.spentMwk),
    }),
    {
      allocatedUsd: 0,
      balanceUsdRemaining: 0,
      allocatedMwk: 0,
      balanceMwkRemaining: 0,
      spentUsd: 0,
      spentMwk: 0,
    }
  );

  return {
    monthKey,
    notes,
    lots: formattedLots,
    ...totals,
  };
}

type DeductionPlan = {
  ok: boolean;
  deductions: {
    lotId: string;
    deductedUsd: number;
    deductedMwk: number;
    newBalanceUsd: number;
    newBalanceMwk: number;
  }[];
  totalUsd: number;
  totalMwk: number;
};

/** Spend from oldest allocation lots first — each lot keeps its own rate. */
function planDeductions(lots: LotRow[], amount: number, currency: 'MWK' | 'USD'): DeductionPlan {
  const active = [...lots]
    .filter((l) => roundUsd(Number(l.balanceUsdRemaining)) > 0)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  let remaining = currency === 'USD' ? roundUsd(amount) : roundMwk(amount);
  const deductions: DeductionPlan['deductions'] = [];
  let totalUsd = 0;
  let totalMwk = 0;

  for (const lot of active) {
    if (remaining <= 0) break;

    const rate = Number(lot.rateMwk);
    const balUsd = roundUsd(Number(lot.balanceUsdRemaining));
    const balMwk = roundMwk(Number(lot.balanceMwkRemaining));

    if (currency === 'USD') {
      const takeUsd = Math.min(remaining, balUsd);
      if (takeUsd <= 0) continue;
      const takeMwk = mwkFromUsd(takeUsd, rate);
      deductions.push({
        lotId: lot.id,
        deductedUsd: takeUsd,
        deductedMwk: takeMwk,
        newBalanceUsd: roundUsd(balUsd - takeUsd),
        newBalanceMwk: roundMwk(balMwk - takeMwk),
      });
      remaining = roundUsd(remaining - takeUsd);
      totalUsd = roundUsd(totalUsd + takeUsd);
      totalMwk = roundMwk(totalMwk + takeMwk);
    } else {
      const takeMwk = Math.min(remaining, balMwk);
      if (takeMwk <= 0) continue;
      const takeUsd = usdFromMwk(takeMwk, rate);
      deductions.push({
        lotId: lot.id,
        deductedUsd: takeUsd,
        deductedMwk: takeMwk,
        newBalanceUsd: roundUsd(balUsd - takeUsd),
        newBalanceMwk: roundMwk(balMwk - takeMwk),
      });
      remaining = roundMwk(remaining - takeMwk);
      totalUsd = roundUsd(totalUsd + takeUsd);
      totalMwk = roundMwk(totalMwk + takeMwk);
    }
  }

  const ok = currency === 'USD' ? remaining <= 0 : remaining <= 0;
  return { ok, deductions, totalUsd, totalMwk };
}

function formatRequest(row: {
  id: string;
  budgetId: string;
  requestedByName: string;
  amount: number;
  currency: string;
  payoutMethod: string;
  purpose: string;
  notes: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  mobileMoneyProvider: string | null;
  mobileMoneyNumber: string | null;
  virtualCardEmail: string | null;
  deductedUsd: number | null;
  deductedMwk: number | null;
  status: string;
  managerNote: string | null;
  reviewedAt: Date | null;
  fulfilledAt: Date | null;
  createdAt: Date;
  budget?: { monthKey: string };
}) {
  const currency = row.currency;
  return {
    id: row.id,
    budgetId: row.budgetId,
    monthKey: row.budget?.monthKey ?? null,
    requestedByName: row.requestedByName,
    amount: currency === 'MWK' ? roundMwk(Number(row.amount)) : roundUsd(Number(row.amount)),
    currency,
    payoutMethod: row.payoutMethod,
    purpose: row.purpose,
    notes: row.notes,
    bankName: row.bankName,
    bankAccountName: row.bankAccountName,
    bankAccountNumber: row.bankAccountNumber,
    mobileMoneyProvider: row.mobileMoneyProvider,
    mobileMoneyNumber: row.mobileMoneyNumber,
    virtualCardEmail: row.virtualCardEmail,
    deductedUsd: row.deductedUsd != null ? roundUsd(Number(row.deductedUsd)) : null,
    deductedMwk: row.deductedMwk != null ? roundMwk(Number(row.deductedMwk)) : null,
    status: row.status,
    managerNote: row.managerNote,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    fulfilledAt: row.fulfilledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

const budgetInclude = { select: { monthKey: true } } as const;

async function loadBudgetMonth(monthKey: string) {
  const budget = await prisma.marketingBudget.findUnique({
    where: { monthKey },
    include: { lots: { orderBy: { createdAt: 'asc' } } },
  });
  if (!budget) return null;
  if (budget.lots.length === 0) return null;
  return formatBudgetWithLots(budget.monthKey, budget.lots, budget.notes);
}

async function loadLotsForMonth(monthKey: string): Promise<LotRow[]> {
  const budget = await prisma.marketingBudget.findUnique({
    where: { monthKey },
    include: { lots: { orderBy: { createdAt: 'asc' } } },
  });
  return budget?.lots ?? [];
}

function currencyForPayout(method: string): 'MWK' | 'USD' {
  return method === 'virtual_card' ? 'USD' : 'MWK';
}

function validatePayoutDetails(method: string, body: Record<string, unknown>): string | null {
  if (method === 'bank_transfer') {
    if (!String(body.bankName ?? '').trim()) return 'Bank name is required';
    if (!String(body.bankAccountName ?? '').trim()) return 'Account name is required';
    if (!String(body.bankAccountNumber ?? '').trim()) return 'Account number is required';
  }
  if (method === 'mobile_money') {
    if (!String(body.mobileMoneyProvider ?? '').trim()) return 'Mobile money provider is required';
    if (!String(body.mobileMoneyNumber ?? '').trim()) return 'Mobile money number is required';
  }
  if (method === 'virtual_card') {
    if (!String(body.virtualCardEmail ?? '').trim()) return 'Email for virtual card delivery is required';
  }
  return null;
}

/** Marketing portal — budget for a month */
router.get('/budgets', basicAdminAuth, async (req, res) => {
  try {
    const monthKey = parseMonthKey(req.query.monthKey);
    const budget = await loadBudgetMonth(monthKey);
    res.json({ monthKey, budget });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to load budget' });
  }
});

/** Marketing portal — list requests */
router.get('/requests', basicAdminAuth, async (req, res) => {
  try {
    const monthKey = parseMonthKey(req.query.monthKey);
    const container = await prisma.marketingBudget.findUnique({ where: { monthKey }, select: { id: true } });
    const rows = container
      ? await prisma.marketingFundRequest.findMany({
          where: { budgetId: container.id },
          include: { budget: budgetInclude },
          orderBy: { createdAt: 'desc' },
          take: 200,
        })
      : [];

    res.json({ monthKey, requests: rows.map(formatRequest) });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to load requests' });
  }
});

/** Marketing portal — submit fund request */
router.post('/requests', basicAdminAuth, async (req, res) => {
  try {
    const body = req.body ?? {};
    const payoutMethod = String(body.payoutMethod ?? '').trim();
    if (!PAYOUT_METHODS.includes(payoutMethod as (typeof PAYOUT_METHODS)[number])) {
      return res.status(400).json({ error: 'Invalid payout method' });
    }

    const currency = currencyForPayout(payoutMethod);
    const monthKey = parseMonthKey(body.monthKey);
    const requestedByName = String(body.requestedByName ?? '').trim();
    const purpose = String(body.purpose ?? '').trim();
    const amount = Number(body.amount);

    if (!requestedByName) return res.status(400).json({ error: 'Your name is required' });
    if (!purpose) return res.status(400).json({ error: 'Purpose is required' });
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const detailError = validatePayoutDetails(payoutMethod, body);
    if (detailError) return res.status(400).json({ error: detailError });

    const container = await prisma.marketingBudget.findUnique({ where: { monthKey } });
    if (!container) {
      return res.status(400).json({
        error: `No marketing budget allocated for ${monthKey}. Contact management.`,
      });
    }

    const lots = await loadLotsForMonth(monthKey);
    const roundedAmount = currency === 'MWK' ? roundMwk(amount) : roundUsd(amount);
    const plan = planDeductions(lots, roundedAmount, currency);

    if (!plan.ok) {
      const summary = await loadBudgetMonth(monthKey);
      return res.status(400).json({
        error: `Insufficient budget. Need $${plan.totalUsd.toFixed(2)} / MWK ${plan.totalMwk.toLocaleString()} but only $${summary?.balanceUsdRemaining.toFixed(2) ?? '0.00'} / MWK ${summary?.balanceMwkRemaining.toLocaleString() ?? '0'} remain. Email management for a top-up.`,
      });
    }

    const row = await prisma.marketingFundRequest.create({
      data: {
        budgetId: container.id,
        requestedByName,
        amount: roundedAmount,
        currency,
        payoutMethod,
        purpose,
        notes: String(body.notes ?? '').trim() || null,
        bankName: payoutMethod === 'bank_transfer' ? String(body.bankName).trim() : null,
        bankAccountName: payoutMethod === 'bank_transfer' ? String(body.bankAccountName).trim() : null,
        bankAccountNumber: payoutMethod === 'bank_transfer' ? String(body.bankAccountNumber).trim() : null,
        mobileMoneyProvider: payoutMethod === 'mobile_money' ? String(body.mobileMoneyProvider).trim() : null,
        mobileMoneyNumber: payoutMethod === 'mobile_money' ? String(body.mobileMoneyNumber).trim() : null,
        virtualCardEmail: payoutMethod === 'virtual_card' ? String(body.virtualCardEmail).trim() : null,
      },
      include: { budget: budgetInclude },
    });

    res.status(201).json({ request: formatRequest(row) });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to create request' });
  }
});

/** Manager portal — overview */
router.get('/manager/overview', basicAdminAuth, async (req, res) => {
  try {
    const monthKey = parseMonthKey(req.query.monthKey);
    const [budget, pendingCount, recentRequests] = await Promise.all([
      loadBudgetMonth(monthKey),
      prisma.marketingFundRequest.count({ where: { status: 'pending' } }),
      prisma.marketingFundRequest.findMany({
        where: { budget: { monthKey } },
        include: { budget: budgetInclude },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    res.json({
      monthKey,
      pendingCount,
      budget,
      requests: recentRequests.map(formatRequest),
    });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to load overview' });
  }
});

/** Manager portal — add a new allocation lot (USD + fixed rate — never changes older lots) */
router.post('/manager/budgets', basicAdminAuth, async (req, res) => {
  try {
    const body = req.body ?? {};
    const monthKey = parseMonthKey(body.monthKey);
    const amountUsd = Number(body.amountUsd);
    const rateMwk = Number(body.rateMwk);

    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      return res.status(400).json({ error: 'Invalid USD amount' });
    }
    if (!Number.isFinite(rateMwk) || rateMwk <= 0) {
      return res.status(400).json({ error: 'Invalid MWK rate (must be MWK per $1)' });
    }

    const usd = roundUsd(amountUsd);
    const notes = String(body.notes ?? '').trim() || null;

    let container = await prisma.marketingBudget.findUnique({ where: { monthKey } });
    if (!container) {
      container = await prisma.marketingBudget.create({ data: { monthKey } });
    }

    await prisma.marketingAllocationLot.create({
      data: {
        budgetId: container.id,
        allocatedUsd: usd,
        balanceUsdRemaining: usd,
        balanceMwkRemaining: mwkFromUsd(usd, rateMwk),
        rateMwk,
        notes,
      },
    });

    const budget = await loadBudgetMonth(monthKey);
    res.json({ budget });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to save allocation' });
  }
});

/** Manager portal — clear all allocation lots for a month (balances back to zero) */
router.post('/manager/reset', basicAdminAuth, async (req, res) => {
  try {
    const monthKey = parseMonthKey(req.body?.monthKey);
    const confirm = String(req.body?.confirm ?? '').trim();
    if (confirm !== monthKey) {
      return res.status(400).json({
        error: `Type the month "${monthKey}" in the confirm field to reset allocations`,
      });
    }

    const container = await prisma.marketingBudget.findUnique({ where: { monthKey } });
    if (!container) {
      return res.json({ monthKey, budget: null, deletedLots: 0, pendingRequests: 0 });
    }

    const [pendingRequests, deleteResult] = await prisma.$transaction([
      prisma.marketingFundRequest.count({
        where: { budgetId: container.id, status: 'pending' },
      }),
      prisma.marketingAllocationLot.deleteMany({ where: { budgetId: container.id } }),
    ]);

    const budget = await loadBudgetMonth(monthKey);
    res.json({
      monthKey,
      budget,
      deletedLots: deleteResult.count,
      pendingRequests,
      message:
        pendingRequests > 0
          ? `${deleteResult.count} allocation batch(es) cleared. ${pendingRequests} pending request(s) remain — reject or fulfill manually.`
          : `${deleteResult.count} allocation batch(es) cleared for ${monthKey}.`,
    });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to reset allocations' });
  }
});

/** Manager portal — approve / reject / fulfill */
router.patch('/manager/requests/:id', basicAdminAuth, async (req, res) => {
  try {
    const id = String(req.params.id ?? '').trim();
    const action = String(req.body?.action ?? '').trim();
    const managerNote = String(req.body?.managerNote ?? '').trim() || null;

    if (!['approve', 'reject', 'fulfill'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const existing = await prisma.marketingFundRequest.findUnique({
      where: { id },
      include: { budget: { include: { lots: { orderBy: { createdAt: 'asc' } } } } },
    });
    if (!existing) return res.status(404).json({ error: 'Request not found' });

    if (action === 'approve') {
      if (existing.status !== 'pending') {
        return res.status(400).json({ error: 'Only pending requests can be approved' });
      }

      const currency = existing.currency as 'MWK' | 'USD';
      const amount = currency === 'MWK' ? roundMwk(Number(existing.amount)) : roundUsd(Number(existing.amount));
      const plan = planDeductions(existing.budget.lots, amount, currency);

      if (!plan.ok) {
        return res.status(400).json({ error: 'Insufficient budget balance' });
      }

      await prisma.$transaction([
        prisma.marketingFundRequest.update({
          where: { id },
          data: {
            status: 'approved',
            managerNote,
            reviewedAt: new Date(),
            deductedUsd: plan.totalUsd,
            deductedMwk: plan.totalMwk,
          },
        }),
        ...plan.deductions.map((d) =>
          prisma.marketingAllocationLot.update({
            where: { id: d.lotId },
            data: {
              balanceUsdRemaining: d.newBalanceUsd,
              balanceMwkRemaining: d.newBalanceMwk,
            },
          })
        ),
      ]);

      const withBudget = await prisma.marketingFundRequest.findUnique({
        where: { id },
        include: { budget: budgetInclude },
      });
      return res.json({ request: formatRequest(withBudget!) });
    }

    if (action === 'reject') {
      if (existing.status !== 'pending') {
        return res.status(400).json({ error: 'Only pending requests can be rejected' });
      }
      const row = await prisma.marketingFundRequest.update({
        where: { id },
        data: { status: 'rejected', managerNote, reviewedAt: new Date() },
        include: { budget: budgetInclude },
      });
      return res.json({ request: formatRequest(row) });
    }

    if (existing.status !== 'approved') {
      return res.status(400).json({ error: 'Only approved requests can be marked fulfilled' });
    }
    const row = await prisma.marketingFundRequest.update({
      where: { id },
      data: {
        status: 'fulfilled',
        managerNote: managerNote ?? existing.managerNote,
        fulfilledAt: new Date(),
      },
      include: { budget: budgetInclude },
    });
    return res.json({ request: formatRequest(row) });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to update request' });
  }
});

export default router;
