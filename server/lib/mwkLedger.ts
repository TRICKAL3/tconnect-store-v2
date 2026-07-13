export type MwkLedgerRow = {
  id: string;
  assetType: string;
  direction: string;
  quantityMwk: number | null;
  purpose: string | null;
  reference: string | null;
  notes: string | null;
  balanceAfterMwk: number | null;
  createdAt: Date;
};

export type MwkCategoryTotal = {
  purpose: string;
  label: string;
  totalMwk: number;
};

export type MwkSnapshot = {
  balanceMwk: number;
  totalInMwk: number;
  totalOutMwk: number;
  netFlowMwk: number;
  outByCategory: MwkCategoryTotal[];
};

export const MWK_IN_PURPOSES = [
  { value: 'sales_revenue', label: 'Sales revenue (MWK in)' },
  { value: 'mobile_money_in', label: 'Mobile money received' },
  { value: 'bank_deposit', label: 'Bank deposit' },
  { value: 'adjustment', label: 'Manual adjustment' },
  { value: 'other', label: 'Other income' },
] as const;

export const MWK_OUT_PURPOSES = [
  { value: 'expense', label: 'Business expense' },
  { value: 'giveaway', label: 'Giveaway / promo cash' },
  { value: 'spin_win', label: 'Spin wheel win payout' },
  { value: 'bonus', label: 'Bonus payment' },
  { value: 'tconnect_points', label: 'TConnect points cost' },
  { value: 'promotion', label: 'Promotion / discount' },
  { value: 'utility_bill', label: 'Utility bill cost' },
  { value: 'adjustment', label: 'Manual adjustment' },
  { value: 'other', label: 'Other expense' },
] as const;

const PURPOSE_LABELS: Record<string, string> = {};
for (const p of [...MWK_IN_PURPOSES, ...MWK_OUT_PURPOSES]) {
  PURPOSE_LABELS[p.value] = p.label;
}

export function mwkPurposeLabel(purpose: string | null | undefined): string {
  if (!purpose) return '—';
  return PURPOSE_LABELS[purpose] || purpose.replace(/_/g, ' ');
}

export function computeMwkSnapshot(rows: MwkLedgerRow[]): MwkSnapshot {
  let balanceMwk = 0;
  let totalInMwk = 0;
  let totalOutMwk = 0;
  const outTotals: Record<string, number> = {};

  const sorted = [...rows].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const row of sorted) {
    const amt = Math.max(0, Math.round(Number(row.quantityMwk) || 0));
    if (!amt) continue;
    if (row.direction === 'in') {
      balanceMwk += amt;
      totalInMwk += amt;
    } else {
      balanceMwk -= amt;
      totalOutMwk += amt;
      const key = String(row.purpose || 'other').trim() || 'other';
      outTotals[key] = (outTotals[key] || 0) + amt;
    }
  }

  const outByCategory = Object.entries(outTotals)
    .map(([purpose, totalMwk]) => ({
      purpose,
      label: mwkPurposeLabel(purpose),
      totalMwk,
    }))
    .sort((a, b) => b.totalMwk - a.totalMwk);

  return {
    balanceMwk,
    totalInMwk,
    totalOutMwk,
    netFlowMwk: totalInMwk - totalOutMwk,
    outByCategory,
  };
}

export function nextMwkBalance(current: number, direction: 'in' | 'out', amountMwk: number): number {
  const amt = Math.max(0, Math.round(amountMwk));
  return direction === 'in' ? current + amt : Math.max(0, current - amt);
}
