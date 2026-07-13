/** TConnect store Wallet — USD balance; MWK uses admin `store_wallet` rate. */
export const WALLET_CHECKOUT_SURCHARGE_RATE = 0.05;
export const WALLET_CHECKOUT_SURCHARGE_PERCENT = 5;

export function walletCheckoutFeeUsd(subtotalUsd: number): number {
  return Math.round(subtotalUsd * WALLET_CHECKOUT_SURCHARGE_RATE * 100) / 100;
}

export function walletCheckoutChargeUsd(subtotalUsd: number): number {
  return Math.round(subtotalUsd * (1 + WALLET_CHECKOUT_SURCHARGE_RATE) * 100) / 100;
}

export const WALLET_TOPUP_MIN_USD = 1;
export const WALLET_TOPUP_MAX_USD = 100;
