/** Virtual card fulfillment stored in OrderItem.giftCardCodes (JSON array). */

export function isVirtualCardOrderItem(item: { type?: string; name?: string } | null | undefined): boolean {
  if (!item) return false;
  const t = String(item.type || '').trim().toLowerCase();
  if (t === 'virtual-card') return true;
  const name = String(item.name || '').toLowerCase();
  return (t === 'giftcard' || t === 'gift-card') && name.includes('virtual card');
}

export type VirtualCardDetails = {
  cardNumber: string;
  expireDate: string;
  cvv: string;
};

export function normalizeVirtualCardFromStored(raw: unknown): VirtualCardDetails | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const cardNumber = String(o.cardNumber || '').trim();
  const expireDate = String(o.expireDate || o.expiryDate || '').trim();
  const cvv = String(o.cvv || '').trim();
  if (cardNumber && expireDate && cvv) {
    return { cardNumber, expireDate, cvv };
  }
  return null;
}

export function parseVirtualCardDetailsList(item: {
  giftCardCodes?: string | unknown[] | null;
}): VirtualCardDetails[] {
  if (!item?.giftCardCodes) return [];
  try {
    const c =
      typeof item.giftCardCodes === 'string'
        ? JSON.parse(item.giftCardCodes)
        : item.giftCardCodes;
    if (!Array.isArray(c)) return [];
    return c.map(normalizeVirtualCardFromStored).filter((x): x is VirtualCardDetails => x != null);
  } catch {
    return [];
  }
}

export function isVirtualCardDetailsComplete(d: VirtualCardDetails): boolean {
  return Boolean(d.cardNumber.trim() && d.expireDate.trim() && d.cvv.trim());
}

export function orderItemHasVirtualCardDetails(item: {
  giftCardCodes?: string | unknown[] | null;
}): boolean {
  const list = parseVirtualCardDetailsList(item);
  const qty = Math.max(1, Number((item as { quantity?: number }).quantity) || 1);
  return list.length >= qty && list.every(isVirtualCardDetailsComplete);
}
