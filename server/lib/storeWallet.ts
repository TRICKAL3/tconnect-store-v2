import { prisma } from './prisma';
import { roundUsd } from './wallet';

/** Rate type for TConnect account Wallet (top-up MWK, balance display) — separate from product "wallet" rate. */
export const STORE_WALLET_RATE_TYPE = 'store_wallet';

export const WALLET_CHECKOUT_SURCHARGE_RATE = 0.05;

export async function getStoreWalletMwkPerUsd(): Promise<number> {
  const store = await prisma.rate.findFirst({
    where: { type: STORE_WALLET_RATE_TYPE },
    orderBy: { createdAt: 'desc' },
  });
  if (store?.value && store.value > 0) return store.value;

  const legacy = await prisma.rate.findFirst({
    where: { type: 'wallet' },
    orderBy: { createdAt: 'desc' },
  });
  return legacy?.value && legacy.value > 0 ? legacy.value : 1700;
}

export function walletCheckoutFeeUsd(subtotalUsd: number): number {
  return roundUsd(subtotalUsd * WALLET_CHECKOUT_SURCHARGE_RATE);
}

export function walletCheckoutChargeUsd(subtotalUsd: number): number {
  return roundUsd(subtotalUsd * (1 + WALLET_CHECKOUT_SURCHARGE_RATE));
}
