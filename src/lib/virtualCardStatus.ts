export const VIRTUAL_CARD_STATUSES = ['pending', 'active', 'frozen', 'expired', 'closed'] as const;
export type VirtualCardStatus = (typeof VIRTUAL_CARD_STATUSES)[number];

export const VIRTUAL_CARD_TXN_TYPES = [
  'purchase',
  'refund',
  'fee',
  'topup',
  'adjustment',
  'other',
] as const;
export type VirtualCardTxnType = (typeof VIRTUAL_CARD_TXN_TYPES)[number];

export const VIRTUAL_CARD_TXN_STATUSES = ['completed', 'pending', 'declined'] as const;
export type VirtualCardTxnStatus = (typeof VIRTUAL_CARD_TXN_STATUSES)[number];

export function virtualCardTxnStatusLabel(status: string): string {
  const map: Record<string, string> = {
    completed: 'Approved',
    pending: 'Pending',
    declined: 'Declined',
  };
  return map[status] ?? status;
}

export function virtualCardTxnStatusClass(status: string): string {
  const map: Record<string, string> = {
    completed: 'bg-green-500/15 text-green-300 border-green-500/30',
    pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    declined: 'bg-red-500/15 text-red-300 border-red-500/30',
  };
  return map[status] ?? 'bg-gray-500/15 text-gray-300 border-gray-500/30';
}

export function virtualCardStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'Pending activation',
    active: 'Active',
    frozen: 'Frozen',
    expired: 'Expired',
    closed: 'Closed',
  };
  return map[status] ?? status;
}

export function virtualCardStatusClass(status: string): string {
  const map: Record<string, string> = {
    pending: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    active: 'bg-green-500/15 text-green-300 border-green-500/30',
    frozen: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    expired: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
    closed: 'bg-red-500/15 text-red-300 border-red-500/30',
  };
  return map[status] ?? 'bg-gray-500/15 text-gray-300 border-gray-500/30';
}

export function virtualCardTxnTypeLabel(type: string): string {
  const map: Record<string, string> = {
    purchase: 'Purchase',
    refund: 'Refund',
    fee: 'Fee',
    topup: 'Top-up',
    adjustment: 'Adjustment',
    other: 'Other',
  };
  return map[type] ?? type;
}
