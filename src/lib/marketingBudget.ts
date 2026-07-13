export type AllocationLot = {
  id: string;
  rateMwk: number;
  allocatedUsd: number;
  balanceUsdRemaining: number;
  allocatedMwk: number;
  balanceMwkRemaining: number;
  spentUsd: number;
  spentMwk: number;
  notes: string | null;
  createdAt: string;
};

export type MarketingBudgetView = {
  monthKey: string;
  notes: string | null;
  lots: AllocationLot[];
  allocatedUsd: number;
  balanceUsdRemaining: number;
  allocatedMwk: number;
  balanceMwkRemaining: number;
  spentUsd: number;
  spentMwk: number;
};

function roundUsd(n: number) {
  return Math.round(n * 100) / 100;
}

function roundMwk(n: number) {
  return Math.round(n);
}

function mwkFromUsd(usd: number, rate: number) {
  return roundMwk(usd * rate);
}

function usdFromMwk(mwk: number, rate: number) {
  return rate > 0 ? roundUsd(mwk / rate) : 0;
}

/** Mirror server FIFO — oldest allocation lot spent first, each at its own rate. */
export function previewDeduction(
  lots: AllocationLot[],
  amount: number,
  currency: 'MWK' | 'USD'
): { ok: boolean; totalUsd: number; totalMwk: number } {
  const active = [...lots]
    .filter((l) => l.balanceUsdRemaining > 0)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  let remaining = currency === 'USD' ? roundUsd(amount) : roundMwk(amount);
  let totalUsd = 0;
  let totalMwk = 0;

  for (const lot of active) {
    if (remaining <= 0) break;
    const rate = lot.rateMwk;

    if (currency === 'USD') {
      const takeUsd = Math.min(remaining, lot.balanceUsdRemaining);
      if (takeUsd <= 0) continue;
      totalUsd = roundUsd(totalUsd + takeUsd);
      totalMwk = roundMwk(totalMwk + mwkFromUsd(takeUsd, rate));
      remaining = roundUsd(remaining - takeUsd);
    } else {
      const takeMwk = Math.min(remaining, lot.balanceMwkRemaining);
      if (takeMwk <= 0) continue;
      totalMwk = roundMwk(totalMwk + takeMwk);
      totalUsd = roundUsd(totalUsd + usdFromMwk(takeMwk, rate));
      remaining = roundMwk(remaining - takeMwk);
    }
  }

  return { ok: remaining <= 0, totalUsd, totalMwk };
}
