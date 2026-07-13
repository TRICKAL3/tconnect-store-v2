import { prisma } from './prisma';
import { getStoreWalletMwkPerUsd } from './storeWallet';

export const WALLET_TOPUP_MIN_USD = 1;
export const WALLET_TOPUP_MAX_USD = 100;

export async function getLatestMwkPerUsd(type: 'wallet' | 'giftcard' | 'store_wallet' = 'wallet'): Promise<number> {
  const rate = await prisma.rate.findFirst({
    where: { type },
    orderBy: { createdAt: 'desc' },
  });
  return rate?.value && rate.value > 0 ? rate.value : 1850;
}

export async function usdToMwkForWalletTopUp(usd: number): Promise<number> {
  const mwkPerUsd = await getStoreWalletMwkPerUsd();
  return Math.max(1, Math.round(usd * mwkPerUsd));
}

export async function mwkToUsdForWalletTopUp(mwk: number): Promise<number> {
  const mwkPerUsd = await getStoreWalletMwkPerUsd();
  return roundUsd(Math.max(0, mwk) / mwkPerUsd);
}

export function usdToMwkAtRate(usd: number, mwkPerUsd: number): number {
  return Math.max(0, Math.round(usd * mwkPerUsd));
}

export function roundUsd(n: number): number {
  return Math.round(n * 100) / 100;
}

/** User started a new top-up — abandon any previous pending PawaPay sessions. */
export async function cancelPendingWalletTopUpsForUser(userId: string): Promise<number> {
  const result = await prisma.walletTopUp.updateMany({
    where: { userId, status: 'pending' },
    data: { status: 'cancelled' },
  });
  return result.count;
}
