import type { Prisma } from '@prisma/client';

type ProductRow = {
  id: string;
  name: string;
  type: string;
  category: string | null;
  image?: string | null;
  priceUsd: number;
};

type Tx = Prisma.TransactionClient;

export type SpinDetailKind = 'paypal_email' | 'binance_id';

export function spinProductDetailKind(product: { type: string; name: string }): SpinDetailKind | null {
  const t = String(product.type || '').trim().toLowerCase();
  const name = String(product.name || '').trim().toLowerCase();
  if (t === 'crypto') return 'binance_id';
  if (t === 'wallet' && (name.includes('paypal') || name.includes('pay pal'))) {
    return 'paypal_email';
  }
  return null;
}

async function latestRateMwk(tx: Tx, productType: string): Promise<number> {
  const t = String(productType || '').trim().toLowerCase();
  let rateType = 'giftcard';
  if (t === 'crypto') rateType = 'crypto';
  else if (t === 'wallet' || t === 'virtual-card') rateType = 'wallet';
  const row = await tx.rate.findFirst({
    where: { type: rateType },
    orderBy: { createdAt: 'desc' },
  });
  return row?.value ?? (rateType === 'crypto' ? 1800 : rateType === 'wallet' ? 1850 : 1900);
}

export async function createSpinPrizeOrder(
  tx: Tx,
  userId: string,
  product: ProductRow,
  prizeLabel: string,
  delivery: Record<string, unknown>,
  prizeAmountUsd?: number | null
) {
  const custom = prizeAmountUsd != null && Number(prizeAmountUsd) > 0 ? Number(prizeAmountUsd) : null;
  const catalogUsd = Number(product.priceUsd) || 0;
  const totalUsd = Math.max(0, custom != null ? custom : catalogUsd);
  const rate = await latestRateMwk(tx, product.type);
  const totalMwk = Math.max(1, Math.round(totalUsd * rate));

  const metadata = {
    spinPrize: true,
    prizeLabel,
    source: 'spin_wheel',
    ...delivery,
  };

  const order = await tx.order.create({
    data: {
      userId,
      status: 'pending',
      totalUsd,
      totalMwk,
      items: {
        create: [
          {
            productId: product.id,
            name: product.name,
            type: product.type,
            category: product.category || 'Spin Prize',
            image: product.image,
            priceUsd: totalUsd,
            quantity: 1,
            metadata: JSON.stringify(metadata),
          },
        ],
      },
    },
    include: { items: true },
  });

  await tx.notification.create({
    data: {
      userId: null,
      type: 'order_created',
      title: 'New order (Spin prize)',
      message: `Spin win — ${product.name} for user (${prizeLabel}). Order #${order.id.substring(0, 8)}`,
      link: `/admin?tab=orders&orderId=${order.id}`,
      read: false,
    },
  });

  return order;
}
