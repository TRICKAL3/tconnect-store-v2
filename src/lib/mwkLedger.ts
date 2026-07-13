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

const LABELS: Record<string, string> = {};
for (const p of [...MWK_IN_PURPOSES, ...MWK_OUT_PURPOSES]) {
  LABELS[p.value] = p.label;
}

export function mwkPurposeLabel(purpose: string | null | undefined): string {
  if (!purpose) return '—';
  return LABELS[purpose] || purpose.replace(/_/g, ' ');
}

export type MwkSnapshot = {
  balanceMwk: number;
  totalInMwk: number;
  totalOutMwk: number;
  netFlowMwk: number;
  outByCategory: { purpose: string; label: string; totalMwk: number }[];
};
