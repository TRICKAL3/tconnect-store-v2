/** Max order total (USD) for mobile money checkout. */
export const MOBILE_MONEY_MAX_CHECKOUT_USD = 10;

export type MobileMoneyProvider = 'paychangu' | 'pawapay';
export const ACTIVE_MOBILE_MONEY_PROVIDER: MobileMoneyProvider = 'paychangu';

export const PAYCHANGU_CHECKOUT_ENABLED = true;
export const PAWAPAY_CHECKOUT_ENABLED = false;
export const WALLET_CHECKOUT_ENABLED = false;

export const MOBILE_MONEY_CHECKOUT_ENABLED =
  PAYCHANGU_CHECKOUT_ENABLED || PAWAPAY_CHECKOUT_ENABLED;
