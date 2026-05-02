export interface CartItem {
  /** Catalog product id (promotions etc. match on this). */
  id: string;
  /** Unique line identity in cart (required for distinct gift-card amounts). */
  cartLineId?: string;
  name: string;
  /** Unit price USD (gift card = chosen denomination per card). */
  price: number;
  category: string;
  type: 'giftcard' | 'crypto' | 'wallet';
  image?: string;
  quantity: number;
  metadata?: Record<string, any>;
}

export function cartLineKey(item: Pick<CartItem, 'cartLineId' | 'id' | 'type' | 'price'>): string {
  if (item.cartLineId) return item.cartLineId;
  if (item.type === 'giftcard') {
    return `gc:${item.id}:${Number(item.price).toFixed(2)}`;
  }
  return item.id;
}

export function withCartLineId(item: CartItem): CartItem {
  return { ...item, cartLineId: cartLineKey(item) };
}

/** Union lines from server and localStorage; same line in both places takes max qty (mirrored snapshot, not additive). */
export function mergeCartLines(server: CartItem[], local: CartItem[]): CartItem[] {
  const m = new Map<string, CartItem>();
  for (const raw of server) {
    const it = withCartLineId(raw);
    m.set(cartLineKey(it), { ...it });
  }
  for (const raw of local) {
    const it = withCartLineId(raw);
    const k = cartLineKey(it);
    const ex = m.get(k);
    if (ex) m.set(k, { ...ex, quantity: Math.max(ex.quantity, it.quantity) });
    else m.set(k, it);
  }
  return Array.from(m.values());
}

/** Best-effort parse for localStorage / server JSON */
export function parseCartItems(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  const out: CartItem[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const id = String(o.id || '');
    const name = String(o.name || '');
    const price = Number(o.price);
    const category = String(o.category || 'general');
    let t = String(o.type || '');
    if (t === 'virtual-card') t = 'wallet';
    const quantity = Number(o.quantity);
    if (!id || !name || !Number.isFinite(price) || !Number.isFinite(quantity) || quantity <= 0) continue;
    if (t !== 'giftcard' && t !== 'crypto' && t !== 'wallet') continue;
    const item: CartItem = {
      id,
      cartLineId: o.cartLineId != null ? String(o.cartLineId) : undefined,
      name,
      price,
      category,
      type: t as CartItem['type'],
      image: o.image != null ? String(o.image) : undefined,
      quantity,
      metadata: typeof o.metadata === 'object' && o.metadata !== null ? (o.metadata as Record<string, any>) : undefined,
    };
    out.push(withCartLineId(item));
  }
  return out;
}
