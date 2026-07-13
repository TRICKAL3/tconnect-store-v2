/** TConnect points redemption: 1300 points = $10 USD value. */
export const POINTS_PER_USD = 130;
export const MIN_POINTS_BALANCE_FOR_CHECKOUT = 1300;
export const MIN_CHECKOUT_VALUE_USD = 10;
/** Must exceed this lifetime paid-purchase total before points can be redeemed. */
export const MIN_LIFETIME_PURCHASE_USD_FOR_POINTS = 20;

export const TCONNECT_POINTS_TERMS = {
  earning: 'Earn 2 points for every $10 spent on approved orders (paid with real money).',
  redemptionRate: '1300 points = $10 USD value at checkout.',
  minBalance:
    'You need at least 1,300 points ($10 value) in your balance before you can redeem points.',
  minPurchase: `You must have more than $${MIN_LIFETIME_PURCHASE_USD_FOR_POINTS} in approved TConnect store purchases before you can redeem points.`,
  spinNote:
    'You cannot only win spin points and save them until $10 — real store purchases on TConnect are required first.',
} as const;

export function pointsTermsBullets(): string[] {
  return [
    TCONNECT_POINTS_TERMS.earning,
    TCONNECT_POINTS_TERMS.redemptionRate,
    TCONNECT_POINTS_TERMS.minBalance,
    TCONNECT_POINTS_TERMS.minPurchase,
    TCONNECT_POINTS_TERMS.spinNote,
  ];
}

export function pointsToUsd(points: number): number {
  return (points / MIN_POINTS_BALANCE_FOR_CHECKOUT) * MIN_CHECKOUT_VALUE_USD;
}

export function usdToPoints(usd: number): number {
  return Math.ceil(usd * POINTS_PER_USD);
}

/** Must hold at least $10 (1300 pts) of balance before points can be used at checkout. */
export function canPayWithTconnectPoints(balance: number): boolean {
  return balance >= MIN_POINTS_BALANCE_FOR_CHECKOUT;
}

export function meetsLifetimePurchaseRequirement(lifetimePurchaseUsd: number): boolean {
  return lifetimePurchaseUsd > MIN_LIFETIME_PURCHASE_USD_FOR_POINTS;
}

/** Balance + lifetime paid purchases must both qualify before checkout redemption. */
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
