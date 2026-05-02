import { parseCartItems, type CartItem } from './cartTypes';

/** Keep in sync across app */
export const CART_LS_KEY = 'tconnect-cart-v2';

export function readPersistedCartFromStorage(): CartItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CART_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parseCartItems(parsed);
  } catch {
    return [];
  }
}

export function writePersistedCartToStorage(items: CartItem[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CART_LS_KEY, JSON.stringify(items));
  } catch {
    /* quota / privacy mode */
  }
}
