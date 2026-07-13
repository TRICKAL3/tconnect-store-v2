/** TConnect points redemption: 1300 points = $10 USD value. */
export const POINTS_PER_USD = 130;
export const MIN_POINTS_BALANCE_FOR_CHECKOUT = 1300;
export const MIN_CHECKOUT_VALUE_USD = 10;
/** Must exceed this lifetime paid-purchase total before points can be redeemed. */
export const MIN_LIFETIME_PURCHASE_USD_FOR_POINTS = 20;

export function pointsToUsd(points: number): number {
  return (points / MIN_POINTS_BALANCE_FOR_CHECKOUT) * MIN_CHECKOUT_VALUE_USD;
}

export function usdToPoints(usd: number): number {
  return Math.ceil(usd * POINTS_PER_USD);
}

export function canPayWithTconnectPoints(balance: number): boolean {
  return balance >= MIN_POINTS_BALANCE_FOR_CHECKOUT;
}

export function meetsLifetimePurchaseRequirement(lifetimePurchaseUsd: number): boolean {
  return lifetimePurchaseUsd > MIN_LIFETIME_PURCHASE_USD_FOR_POINTS;
}

export function canRedeemTconnectPoints(balance: number, lifetimePurchaseUsd: number): boolean {
  return canPayWithTconnectPoints(balance) && meetsLifetimePurchaseRequirement(lifetimePurchaseUsd);
}

export function pointsRedemptionBlockReason(
  balance: number,
  lifetimePurchaseUsd: number
): string | null {
  if (!meetsLifetimePurchaseRequirement(lifetimePurchaseUsd)) {
    return `You need more than $${MIN_LIFETIME_PURCHASE_USD_FOR_POINTS} in approved TConnect purchases before redeeming points. Your total so far: $${lifetimePurchaseUsd.toFixed(2)}.`;
  }
  if (!canPayWithTconnectPoints(balance)) {
    return `You need at least ${MIN_POINTS_BALANCE_FOR_CHECKOUT.toLocaleString()} points ($10 value) before you can pay with points at checkout.`;
  }
  return null;
}
