export type InventoryAssetType = 'usdt' | 'giftcard';

export type InventoryLedgerRow = {
  id: string;
  assetType: string;
  direction: string;
  quantityUsd: number;
  buyRateMwk: number | null;
  sellRateMwk: number | null;
  costBasisMwk: number | null;
  revenueMwk: number | null;
  profitLossMwk: number | null;
  purpose: string | null;
  reference: string | null;
  notes: string | null;
  giftCardName: string | null;
  balanceAfterUsd: number | null;
  avgBuyRateMwk: number | null;
  createdAt: Date;
};

export type InventorySnapshot = {
  balanceUsd: number;
  avgBuyRateMwk: number;
  totalCostBasisMwk: number;
  totalInUsd: number;
  totalOutUsd: number;
  realizedProfitLossMwk: number;
};

export function roundUsd(n: number): number {
  return Math.round(n * 100) / 100;
}

export function roundMwk(n: number): number {
  return Math.round(n);
}

export function computeInventorySnapshot(rows: InventoryLedgerRow[]): InventorySnapshot {
  let balanceUsd = 0;
  let avgBuyRateMwk = 0;
  let totalCostBasisMwk = 0;
  let totalInUsd = 0;
  let totalOutUsd = 0;
  let realizedProfitLossMwk = 0;

  const sorted = [...rows].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const row of sorted) {
    const qty = Math.max(0, Number(row.quantityUsd) || 0);
    if (row.direction === 'in') {
      const buyRate = Math.max(0, Number(row.buyRateMwk) || 0);
      const prevCost = balanceUsd * avgBuyRateMwk;
      balanceUsd += qty;
      totalInUsd += qty;
      if (balanceUsd > 0 && buyRate > 0) {
        avgBuyRateMwk = (prevCost + qty * buyRate) / balanceUsd;
      }
    } else if (row.direction === 'out') {
      const sellRate = Math.max(0, Number(row.sellRateMwk) || 0);
      const outQty = Math.min(qty, balanceUsd);
      balanceUsd = Math.max(0, balanceUsd - qty);
      totalOutUsd += qty;
      const cost = roundMwk(outQty * avgBuyRateMwk);
      const revenue = sellRate > 0 ? roundMwk(outQty * sellRate) : 0;
      realizedProfitLossMwk += revenue - cost;
      if (balanceUsd <= 0) {
        avgBuyRateMwk = 0;
      }
    }
  }

  totalCostBasisMwk = roundMwk(balanceUsd * avgBuyRateMwk);

  return {
    balanceUsd: roundUsd(balanceUsd),
    avgBuyRateMwk: roundUsd(avgBuyRateMwk),
    totalCostBasisMwk,
    totalInUsd: roundUsd(totalInUsd),
    totalOutUsd: roundUsd(totalOutUsd),
    realizedProfitLossMwk,
  };
}

export function buildOutEntryMetrics(
  balanceUsd: number,
  avgBuyRateMwk: number,
  quantityUsd: number,
  sellRateMwk: number
): {
  costBasisMwk: number;
  revenueMwk: number;
  profitLossMwk: number;
  balanceAfterUsd: number;
} {
  const qty = Math.max(0, quantityUsd);
  const outQty = Math.min(qty, Math.max(0, balanceUsd));
  const costBasisMwk = roundMwk(outQty * avgBuyRateMwk);
  const revenueMwk = roundMwk(outQty * Math.max(0, sellRateMwk));
  return {
    costBasisMwk,
    revenueMwk,
    profitLossMwk: revenueMwk - costBasisMwk,
    balanceAfterUsd: roundUsd(Math.max(0, balanceUsd - qty)),
  };
}

export function buildInEntryMetrics(
  balanceUsd: number,
  avgBuyRateMwk: number,
  quantityUsd: number,
  buyRateMwk: number
): { balanceAfterUsd: number; avgBuyRateMwk: number } {
  const qty = Math.max(0, quantityUsd);
  const buyRate = Math.max(0, buyRateMwk);
  const prevCost = balanceUsd * avgBuyRateMwk;
  const balanceAfterUsd = roundUsd(balanceUsd + qty);
  const nextAvg =
    balanceAfterUsd > 0 && buyRate > 0
      ? roundUsd((prevCost + qty * buyRate) / balanceAfterUsd)
      : avgBuyRateMwk;
  return { balanceAfterUsd, avgBuyRateMwk: nextAvg };
}

export const USDT_OUT_PURPOSES = [
  { value: 'virtual_card', label: 'Virtual card sale' },
  { value: 'giftcard_purchase', label: 'Gift card purchase' },
  { value: 'crypto_order', label: 'Crypto / USDT order' },
  { value: 'adjustment', label: 'Manual adjustment' },
  { value: 'other', label: 'Other' },
] as const;

export const USDT_IN_PURPOSES = [
  { value: 'purchase', label: 'USDT purchase' },
  { value: 'adjustment', label: 'Manual adjustment' },
  { value: 'other', label: 'Other' },
] as const;
