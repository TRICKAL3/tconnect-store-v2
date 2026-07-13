/** Max order total (USD) for mobile money checkout. */
export const MOBILE_MONEY_MAX_CHECKOUT_USD = 10;

export type MobileMoneyProvider = 'paychangu' | 'pawapay';
export const ACTIVE_MOBILE_MONEY_PROVIDER: MobileMoneyProvider = 'paychangu';

export const PAYCHANGU_CHECKOUT_ENABLED = true;
export const PAWAPAY_CHECKOUT_ENABLED = false;
export const WALLET_CHECKOUT_ENABLED = false;

export const CHECKOUT_UNAVAILABLE_MOBILE_MONEY =
  'Mobile money checkout is not available at the moment. Please use bank transfer, card link, or points.';

/** @deprecated use CHECKOUT_UNAVAILABLE_MOBILE_MONEY */
export const CHECKOUT_UNAVAILABLE_PAWAPAY = CHECKOUT_UNAVAILABLE_MOBILE_MONEY;

export const CHECKOUT_UNAVAILABLE_WALLET =
  'Wallet checkout is under construction. Please use bank transfer, card link, mobile money, or points.';

export function isMobileMoneyPaymentMethod(method: string | null | undefined): boolean {
  const m = String(method || '').trim().toLowerCase();
  return m === 'paychangu' || m === 'pawapay';
}
