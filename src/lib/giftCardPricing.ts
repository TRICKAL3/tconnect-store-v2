/** Buyer-chosen denomination (USD) per gift card at checkout — not fixed catalog pricing. */

export const GIFTCARD_BUYER_MIN_USD = 0;
export const GIFTCARD_BUYER_MAX_USD = 1000;

/** Admin must set catalog `priceUsd` in this band (used as suggested default when opening product). */
export const GIFTCARD_ADMIN_MIN_USD = 1;
export const GIFTCARD_ADMIN_MAX_USD = 1000;

export function clampGiftCardBuyerUsd(n: number): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.min(GIFTCARD_BUYER_MAX_USD, Math.max(GIFTCARD_BUYER_MIN_USD, Math.round(x * 100) / 100));
}

export function clampGiftCardAdminUsd(n: number): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return GIFTCARD_ADMIN_MIN_USD;
  return Math.min(
    GIFTCARD_ADMIN_MAX_USD,
    Math.max(GIFTCARD_ADMIN_MIN_USD, Math.round(x * 100) / 100)
  );
}

export function isGiftCardAdminPriceValid(n: number): boolean {
  const x = Number(n);
  if (!Number.isFinite(x)) return false;
  return x >= GIFTCARD_ADMIN_MIN_USD && x <= GIFTCARD_ADMIN_MAX_USD;
}

/** Default amount prefilled from DB `priceUsd` (already admin-validated range). */
export function defaultBuyerAmountFromCatalog(priceUsd: number): number {
  const c = clampGiftCardBuyerUsd(priceUsd);
  if (c <= 0) return GIFTCARD_ADMIN_MIN_USD;
  return c;
}

export function buyerCanCheckoutGiftCardUsd(n: number): boolean {
  const c = clampGiftCardBuyerUsd(n);
  return c > 0 && c <= GIFTCARD_BUYER_MAX_USD;
}
