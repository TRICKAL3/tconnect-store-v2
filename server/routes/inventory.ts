import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { basicAdminAuth } from '../lib/adminAuth';
import {
  buildInEntryMetrics,
  buildOutEntryMetrics,
  computeInventorySnapshot,
  roundUsd,
  type InventoryAssetType,
  type InventoryLedgerRow,
} from '../lib/inventoryLedger';
import {
  computeMwkSnapshot,
  mwkPurposeLabel,
  nextMwkBalance,
  type MwkLedgerRow,
} from '../lib/mwkLedger';

const router = Router();

async function loadLedger(assetType: InventoryAssetType): Promise<InventoryLedgerRow[]> {
  return prisma.inventoryEntry.findMany({
    where: { assetType },
    orderBy: { createdAt: 'asc' },
  });
}

function formatEntry(row: InventoryLedgerRow) {
  return {
    ...row,
    quantityUsd: roundUsd(Number(row.quantityUsd)),
    buyRateMwk: row.buyRateMwk != null ? roundUsd(Number(row.buyRateMwk)) : null,
    sellRateMwk: row.sellRateMwk != null ? roundUsd(Number(row.sellRateMwk)) : null,
    balanceAfterUsd: row.balanceAfterUsd != null ? roundUsd(Number(row.balanceAfterUsd)) : null,
    avgBuyRateMwk: row.avgBuyRateMwk != null ? roundUsd(Number(row.avgBuyRateMwk)) : null,
  };
}

async function loadMwkLedger(): Promise<MwkLedgerRow[]> {
  return prisma.inventoryEntry.findMany({
    where: { assetType: 'mwk' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      assetType: true,
      direction: true,
      quantityMwk: true,
      purpose: true,
      reference: true,
      notes: true,
      balanceAfterMwk: true,
      createdAt: true,
    },
  });
}

function formatMwkEntry(row: MwkLedgerRow) {
  return {
    ...row,
    quantityMwk: row.quantityMwk != null ? Math.round(Number(row.quantityMwk)) : null,
    balanceAfterMwk: row.balanceAfterMwk != null ? Math.round(Number(row.balanceAfterMwk)) : null,
    purposeLabel: mwkPurposeLabel(row.purpose),
  };
}

router.get('/summary', basicAdminAuth, async (_req, res) => {
  try {
    const [usdtRows, mwkRows] = await Promise.all([loadLedger('usdt'), loadMwkLedger()]);
    const usdt = computeInventorySnapshot(usdtRows);
    const mwk = computeMwkSnapshot(mwkRows);
    return res.json({ usdt, mwk });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to load summary' });
  }
});

router.get('/ledger', basicAdminAuth, async (req, res) => {
  try {
    const assetType = String(req.query.assetType || 'usdt').trim().toLowerCase();
    if (assetType === 'mwk') {
      const limitRaw = Number(req.query.limit);
      const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, Math.floor(limitRaw))) : 200;
      const allRows = await loadMwkLedger();
      const snapshot = computeMwkSnapshot(allRows);
      const rows = await prisma.inventoryEntry.findMany({
        where: { assetType: 'mwk' },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          assetType: true,
          direction: true,
          quantityMwk: true,
          purpose: true,
          reference: true,
          notes: true,
          balanceAfterMwk: true,
          createdAt: true,
        },
      });
      return res.json({
        snapshot,
        entries: rows.map((r) => formatMwkEntry(r as MwkLedgerRow)),
      });
    }
    if (assetType !== 'usdt' && assetType !== 'giftcard') {
      return res.status(400).json({ error: 'assetType must be usdt, mwk, or giftcard' });
    }
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, Math.floor(limitRaw))) : 200;
    const rows = await prisma.inventoryEntry.findMany({
      where: { assetType },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    const snapshot = computeInventorySnapshot(
      await loadLedger(assetType as InventoryAssetType)
    );
    return res.json({
      snapshot,
      entries: rows.map((r) => formatEntry(r as InventoryLedgerRow)),
    });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to load ledger' });
  }
});

router.post('/usdt/in', basicAdminAuth, async (req, res) => {
  try {
    const quantityUsd = roundUsd(Number(req.body?.quantityUsd));
    const buyRateMwk = roundUsd(Number(req.body?.buyRateMwk));
    const purpose = String(req.body?.purpose || 'purchase').trim() || 'purchase';
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
    const reference = typeof req.body?.reference === 'string' ? req.body.reference.trim() : '';

    if (!Number.isFinite(quantityUsd) || quantityUsd <= 0) {
      return res.status(400).json({ error: 'quantityUsd must be greater than 0' });
    }
    if (!Number.isFinite(buyRateMwk) || buyRateMwk <= 0) {
      return res.status(400).json({ error: 'buyRateMwk must be greater than 0' });
    }

    const prior = computeInventorySnapshot(await loadLedger('usdt'));
    const metrics = buildInEntryMetrics(
      prior.balanceUsd,
      prior.avgBuyRateMwk,
      quantityUsd,
      buyRateMwk
    );

    const entry = await prisma.inventoryEntry.create({
      data: {
        assetType: 'usdt',
        direction: 'in',
        quantityUsd,
        buyRateMwk,
        purpose,
        notes: notes || null,
        reference: reference || null,
        balanceAfterUsd: metrics.balanceAfterUsd,
        avgBuyRateMwk: metrics.avgBuyRateMwk,
        costBasisMwk: Math.round(quantityUsd * buyRateMwk),
      },
    });

    return res.json({ ok: true, entry: formatEntry(entry as InventoryLedgerRow) });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to add USDT' });
  }
});

router.post('/usdt/out', basicAdminAuth, async (req, res) => {
  try {
    const quantityUsd = roundUsd(Number(req.body?.quantityUsd));
    const sellRateMwk = roundUsd(Number(req.body?.sellRateMwk));
    const purpose = String(req.body?.purpose || 'other').trim() || 'other';
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
    const reference = typeof req.body?.reference === 'string' ? req.body.reference.trim() : '';

    if (!Number.isFinite(quantityUsd) || quantityUsd <= 0) {
      return res.status(400).json({ error: 'quantityUsd must be greater than 0' });
    }
    if (!Number.isFinite(sellRateMwk) || sellRateMwk <= 0) {
      return res.status(400).json({ error: 'sellRateMwk must be greater than 0' });
    }

    const prior = computeInventorySnapshot(await loadLedger('usdt'));
    if (quantityUsd > prior.balanceUsd + 0.0001) {
      return res.status(400).json({
        error: `Insufficient USDT balance. Available: ${prior.balanceUsd.toFixed(2)} USDT`,
      });
    }

    const metrics = buildOutEntryMetrics(
      prior.balanceUsd,
      prior.avgBuyRateMwk,
      quantityUsd,
      sellRateMwk
    );

    const entry = await prisma.inventoryEntry.create({
      data: {
        assetType: 'usdt',
        direction: 'out',
        quantityUsd,
        buyRateMwk: prior.avgBuyRateMwk,
        sellRateMwk,
        purpose,
        notes: notes || null,
        reference: reference || null,
        costBasisMwk: metrics.costBasisMwk,
        revenueMwk: metrics.revenueMwk,
        profitLossMwk: metrics.profitLossMwk,
        balanceAfterUsd: metrics.balanceAfterUsd,
        avgBuyRateMwk: metrics.balanceAfterUsd > 0 ? prior.avgBuyRateMwk : 0,
      },
    });

    return res.json({
      ok: true,
      entry: formatEntry(entry as InventoryLedgerRow),
      profitLossMwk: metrics.profitLossMwk,
    });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to deduct USDT' });
  }
});

router.post('/giftcard/in', basicAdminAuth, async (req, res) => {
  try {
    const quantityUsd = roundUsd(Number(req.body?.quantityUsd));
    const buyRateMwk = roundUsd(Number(req.body?.buyRateMwk));
    const giftCardName = String(req.body?.giftCardName || '').trim();
    const purpose = String(req.body?.purpose || 'stock').trim() || 'stock';
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
    const reference = typeof req.body?.reference === 'string' ? req.body.reference.trim() : '';

    if (!giftCardName) return res.status(400).json({ error: 'giftCardName is required' });
    if (!Number.isFinite(quantityUsd) || quantityUsd <= 0) {
      return res.status(400).json({ error: 'quantityUsd (face value) must be greater than 0' });
    }
    if (!Number.isFinite(buyRateMwk) || buyRateMwk <= 0) {
      return res.status(400).json({ error: 'buyRateMwk must be greater than 0' });
    }

    const prior = computeInventorySnapshot(await loadLedger('giftcard'));
    const metrics = buildInEntryMetrics(
      prior.balanceUsd,
      prior.avgBuyRateMwk,
      quantityUsd,
      buyRateMwk
    );

    const entry = await prisma.inventoryEntry.create({
      data: {
        assetType: 'giftcard',
        direction: 'in',
        quantityUsd,
        buyRateMwk,
        giftCardName,
        purpose,
        notes: notes || null,
        reference: reference || null,
        balanceAfterUsd: metrics.balanceAfterUsd,
        avgBuyRateMwk: metrics.avgBuyRateMwk,
        costBasisMwk: Math.round(quantityUsd * buyRateMwk),
      },
    });

    return res.json({ ok: true, entry: formatEntry(entry as InventoryLedgerRow) });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to add gift card stock' });
  }
});

router.post('/giftcard/out', basicAdminAuth, async (req, res) => {
  try {
    const quantityUsd = roundUsd(Number(req.body?.quantityUsd));
    const sellRateMwk = roundUsd(Number(req.body?.sellRateMwk));
    const giftCardName = String(req.body?.giftCardName || '').trim();
    const purpose = String(req.body?.purpose || 'sale').trim() || 'sale';
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
    const reference = typeof req.body?.reference === 'string' ? req.body.reference.trim() : '';

    if (!giftCardName) return res.status(400).json({ error: 'giftCardName is required' });
    if (!Number.isFinite(quantityUsd) || quantityUsd <= 0) {
      return res.status(400).json({ error: 'quantityUsd must be greater than 0' });
    }
    if (!Number.isFinite(sellRateMwk) || sellRateMwk <= 0) {
      return res.status(400).json({ error: 'sellRateMwk must be greater than 0' });
    }

    const prior = computeInventorySnapshot(await loadLedger('giftcard'));
    if (quantityUsd > prior.balanceUsd + 0.0001) {
      return res.status(400).json({
        error: `Insufficient gift card stock ($${prior.balanceUsd.toFixed(2)} available for ${giftCardName})`,
      });
    }

    const metrics = buildOutEntryMetrics(
      prior.balanceUsd,
      prior.avgBuyRateMwk,
      quantityUsd,
      sellRateMwk
    );

    const entry = await prisma.inventoryEntry.create({
      data: {
        assetType: 'giftcard',
        direction: 'out',
        quantityUsd,
        buyRateMwk: prior.avgBuyRateMwk,
        sellRateMwk,
        giftCardName,
        purpose,
        notes: notes || null,
        reference: reference || null,
        costBasisMwk: metrics.costBasisMwk,
        revenueMwk: metrics.revenueMwk,
        profitLossMwk: metrics.profitLossMwk,
        balanceAfterUsd: metrics.balanceAfterUsd,
        avgBuyRateMwk: metrics.balanceAfterUsd > 0 ? prior.avgBuyRateMwk : 0,
      },
    });

    return res.json({
      ok: true,
      entry: formatEntry(entry as InventoryLedgerRow),
      profitLossMwk: metrics.profitLossMwk,
    });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to record gift card sale' });
  }
});

router.post('/mwk/in', basicAdminAuth, async (req, res) => {
  try {
    const amountMwk = Math.max(1, Math.round(Number(req.body?.amountMwk)));
    const purpose = String(req.body?.purpose || 'sales_revenue').trim() || 'sales_revenue';
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
    const reference = typeof req.body?.reference === 'string' ? req.body.reference.trim() : '';

    if (!Number.isFinite(amountMwk) || amountMwk <= 0) {
      return res.status(400).json({ error: 'amountMwk must be greater than 0' });
    }

    const prior = computeMwkSnapshot(await loadMwkLedger());
    const balanceAfterMwk = nextMwkBalance(prior.balanceMwk, 'in', amountMwk);

    const entry = await prisma.inventoryEntry.create({
      data: {
        assetType: 'mwk',
        direction: 'in',
        quantityUsd: 0,
        quantityMwk: amountMwk,
        purpose,
        notes: notes || null,
        reference: reference || null,
        balanceAfterMwk,
      },
    });

    return res.json({ ok: true, entry: formatMwkEntry(entry as MwkLedgerRow) });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to add MWK' });
  }
});

router.post('/mwk/out', basicAdminAuth, async (req, res) => {
  try {
    const amountMwk = Math.max(1, Math.round(Number(req.body?.amountMwk)));
    const purpose = String(req.body?.purpose || 'expense').trim() || 'expense';
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
    const reference = typeof req.body?.reference === 'string' ? req.body.reference.trim() : '';

    if (!Number.isFinite(amountMwk) || amountMwk <= 0) {
      return res.status(400).json({ error: 'amountMwk must be greater than 0' });
    }

    const prior = computeMwkSnapshot(await loadMwkLedger());
    const balanceAfterMwk = nextMwkBalance(prior.balanceMwk, 'out', amountMwk);

    const entry = await prisma.inventoryEntry.create({
      data: {
        assetType: 'mwk',
        direction: 'out',
        quantityUsd: 0,
        quantityMwk: amountMwk,
        purpose,
        notes: notes || null,
        reference: reference || null,
        balanceAfterMwk,
        costBasisMwk: amountMwk,
      },
    });

    return res.json({ ok: true, entry: formatMwkEntry(entry as MwkLedgerRow) });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to record MWK expense' });
  }
});

export default router;
