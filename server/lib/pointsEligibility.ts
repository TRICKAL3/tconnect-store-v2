import { prisma } from './prisma';

type QualifyingOrder = {
  totalUsd: number;
  status: string;
  payment: { method: string; transactionId: string | null } | null;
};

/** Approved/fulfilled paid orders count; points-only checkouts do not. */
export function orderCountsAsLifetimePurchase(order: QualifyingOrder): boolean {
  if (!['approved', 'fulfilled'].includes(order.status)) return false;
  if (!order.payment) return true;
  if (order.payment.method !== 'points') return true;
  const transactionId = order.payment.transactionId || '';
  return transactionId.includes('BANK-');
}

export async function getUserLifetimePurchaseUsd(userId: string): Promise<number> {
  const orders = await prisma.order.findMany({
    where: {
      userId,
      status: { in: ['approved', 'fulfilled'] },
    },
    select: {
      totalUsd: true,
      status: true,
      payment: { select: { method: true, transactionId: true } },
    },
  });

  return orders
    .filter(orderCountsAsLifetimePurchase)
    .reduce((sum, order) => sum + (order.totalUsd || 0), 0);
}
