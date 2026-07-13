import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export function isVirtualCardOrderItem(item: { type?: string; name?: string } | null | undefined): boolean {
  if (!item) return false;
  const t = String(item.type || '').trim().toLowerCase();
  if (t === 'virtual-card') return true;
  const name = String(item.name || '').toLowerCase();
  return (t === 'giftcard' || t === 'gift-card') && name.includes('virtual card');
}

type OrderItemRow = {
  id: string;
  name: string;
  type: string;
  priceUsd: number;
  quantity: number;
  giftCardCodes?: string | null;
};

export type VirtualCardCredentials = {
  cardNumber: string;
  expireDate: string;
  cvv: string;
};

function parseGiftCardCodesArray(giftCardCodes: string | null | undefined): unknown[] | null {
  if (!giftCardCodes) return null;
  try {
    const raw = JSON.parse(giftCardCodes);
    return Array.isArray(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function extractVirtualCardCredentials(
  giftCardCodes: string | null | undefined,
  unitIndex: number
): VirtualCardCredentials | null {
  const raw = parseGiftCardCodesArray(giftCardCodes);
  if (!raw) return null;
  const entry = raw[unitIndex] ?? raw[0];
  if (!entry || typeof entry !== 'object') return null;
  const o = entry as Record<string, unknown>;
  const cardNumber = String(o.cardNumber || '').trim();
  const expireDate = String(o.expireDate || o.expiryDate || '').trim();
  const cvv = String(o.cvv || '').trim();
  if (cardNumber && expireDate && cvv) {
    return { cardNumber, expireDate, cvv };
  }
  return null;
}

function parseVirtualCardLast4(giftCardCodes: string | null | undefined, unitIndex: number): string | null {
  const creds = extractVirtualCardCredentials(giftCardCodes, unitIndex);
  if (!creds) return null;
  const num = creds.cardNumber.replace(/\D/g, '');
  return num.length >= 4 ? num.slice(-4) : null;
}

export async function provisionVirtualCardsForOrder(
  orderId: string,
  opts?: { activate?: boolean },
  client: Prisma.TransactionClient | typeof prisma = prisma
) {
  const order = await client.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order?.userId) return [];

  const created: Awaited<ReturnType<typeof client.userVirtualCard.create>>[] = [];

  for (const item of order.items as OrderItemRow[]) {
    if (!isVirtualCardOrderItem(item)) continue;

    const qty = Math.max(1, item.quantity);
    for (let unit = 0; unit < qty; unit++) {
      const existing = await client.userVirtualCard.findFirst({
        where: { orderItemId: item.id, unitIndex: unit },
      });

      const last4 = parseVirtualCardLast4(item.giftCardCodes, unit);
      const label = qty > 1 ? `${item.name} (#${unit + 1})` : item.name;
      const activate = Boolean(opts?.activate);

      if (existing) {
        const updates: Prisma.UserVirtualCardUpdateInput = {};
        if (last4 && !existing.cardLast4) updates.cardLast4 = last4;
        if (activate && existing.status === 'pending') {
          updates.status = 'active';
          updates.balanceUsd = item.priceUsd;
          if (!existing.cardValueUsd) updates.cardValueUsd = item.priceUsd;
          updates.userNotes =
            'Your TConnect virtual card is active. Balance and transactions update here when refreshed.';
        }
        if (Object.keys(updates).length > 0) {
          const updated = await client.userVirtualCard.update({
            where: { id: existing.id },
            data: updates,
          });
          created.push(updated);
        } else {
          created.push(existing);
        }
        continue;
      }

      const card = await client.userVirtualCard.create({
        data: {
          userId: order.userId,
          orderId: order.id,
          orderItemId: item.id,
          unitIndex: unit,
          label,
          cardLast4: last4,
          balanceUsd: activate ? item.priceUsd : 0,
          cardValueUsd: item.priceUsd,
          initialBalanceUsd: item.priceUsd,
          status: activate ? 'active' : 'pending',
          userNotes: activate
            ? 'Your TConnect virtual card is active. View balance and transactions anytime in My Cards.'
            : 'Your virtual card order is confirmed. Details will appear here once your card is ready.',
        },
      });
      created.push(card);
    }
  }

  return created;
}

/** Ensure every virtual-card order line has a My Cards row (fixes older orders). */
export async function backfillVirtualCardsForUser(userId: string) {
  const orders = await prisma.order.findMany({
    where: {
      userId,
      status: { notIn: ['rejected', 'cancelled', 'awaiting_pawapay'] },
    },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  let count = 0;
  for (const order of orders) {
    const hasVirtual = order.items.some((i) => isVirtualCardOrderItem(i));
    if (!hasVirtual) continue;
    const activate = ['approved', 'fulfilled', 'done'].includes(order.status);
    const cards = await provisionVirtualCardsForOrder(order.id, { activate });
    count += cards.length;
  }
  return count;
}

export function orderHasVirtualCardItems(
  items: Array<{ type?: string; name?: string }>
): boolean {
  return items.some((i) => isVirtualCardOrderItem(i));
}
