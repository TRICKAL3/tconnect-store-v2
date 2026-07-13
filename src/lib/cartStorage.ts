import { parseCartItems, type CartItem } from './cartTypes';
import { cartAccountEmail } from './cartIdentity';

/** Legacy single key (pre per-account storage) */
export const LEGACY_CART_LS_KEY = 'tconnect-cart-v2';

/** Bump when local cart shape/behavior changes so old ghost data is wiped on first visit after deploy. */
const CART_LS_SCHEMA_MARK = `${LEGACY_CART_LS_KEY}:schema`;
const CART_LS_SCHEMA_VERSION = '3-purge-old-buckets';

/**
 * Clears every `tconnect-cart-v2*` key once after upgrade (fixes stale Binance/demo lines stuck from pre-fix builds).
 */
export function migrateCartSchemaIfNeeded(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (localStorage.getItem(CART_LS_SCHEMA_MARK) === CART_LS_SCHEMA_VERSION) return;
    const prefix = `${LEGACY_CART_LS_KEY}:`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k === LEGACY_CART_LS_KEY || k.startsWith(prefix)) {
        localStorage.removeItem(k);
      }
    }
    localStorage.setItem(CART_LS_SCHEMA_MARK, CART_LS_SCHEMA_VERSION);
  } catch {
    /* quota / Safari private */
  }
}

export function guestCartKey(): string {
  return `${LEGACY_CART_LS_KEY}:guest`;
}

/** Logged-in carts are isolated so another account on the same browser does not inherit items. */
export function cartLocalStorageKey(accountEmail?: string | null): string {
  const e = accountEmail?.trim();
  if (!e) return guestCartKey();
  return `${LEGACY_CART_LS_KEY}:acct:${cartAccountEmail(e)}`;
}

/** One-time migration: move legacy blob into guest bucket. */
export function migrateLegacyCartIfNeeded(): void {
  if (typeof localStorage === 'undefined') return;
  migrateCartSchemaIfNeeded();
  try {
    const legacy = localStorage.getItem(LEGACY_CART_LS_KEY);
    if (!legacy || !legacy.trim()) return;
    const guestKey = guestCartKey();
    const existingGuest = localStorage.getItem(guestKey);
    if (existingGuest && existingGuest.trim()) {
      localStorage.removeItem(LEGACY_CART_LS_KEY);
      return;
    }
    localStorage.setItem(guestKey, legacy);
    localStorage.removeItem(LEGACY_CART_LS_KEY);
  } catch {
    /* quota / privacy mode */
  }
}

export function readPersistedCartFromStorage(accountEmail?: string | null): CartItem[] {
  if (typeof localStorage === 'undefined') return [];
  migrateCartSchemaIfNeeded();
  migrateLegacyCartIfNeeded();
  try {
    const raw = localStorage.getItem(cartLocalStorageKey(accountEmail));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parseCartItems(parsed);
  } catch {
    return [];
  }
}

export function writePersistedCartToStorage(items: CartItem[], accountEmail?: string | null): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(cartLocalStorageKey(accountEmail), JSON.stringify(items));
  } catch {
    /* quota */
  }
}

/** After checkout / explicit clear: account snapshot, guest bucket, and legacy key. */
export function clearPersistedCartLocal(accountEmail?: string | null): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(LEGACY_CART_LS_KEY);
    localStorage.removeItem(guestCartKey());
    if (accountEmail?.trim()) {
      localStorage.removeItem(cartLocalStorageKey(accountEmail));
    }
  } catch {
    /* ignore */
  }
}
