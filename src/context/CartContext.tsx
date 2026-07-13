import React, {
  createContext,
  useContext,
  useReducer,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useAuth } from './AuthContext';
import type { CartItem } from '../lib/cartTypes';
import { cartLineKey, mergeCartLines, withCartLineId } from '../lib/cartTypes';
import { loadServerCart, syncServerCart, clearServerCart } from '../lib/cartApi';
import { cartAccountEmail } from '../lib/cartIdentity';
import {
  migrateCartSchemaIfNeeded,
  migrateLegacyCartIfNeeded,
  readPersistedCartFromStorage,
  writePersistedCartToStorage,
  clearPersistedCartLocal,
} from '../lib/cartStorage';

export type { CartItem };
export { cartLineKey };

const SYNC_MS = 650;

interface CartState {
  items: CartItem[];
  total: number;
  itemCount: number;
}

function computeTotals(items: CartItem[]): Pick<CartState, 'total' | 'itemCount'> {
  return {
    total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'HYDRATE'; payload: { items: CartItem[] } }
  | { type: 'MERGE_SERVER'; payload: { serverItems: CartItem[] } };

const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'ADD_ITEM': {
      const payload = withCartLineId(action.payload);
      const lineKey = cartLineKey(payload);
      const existingItem = state.items.find((item) => cartLineKey(item) === lineKey);

      if (existingItem) {
        const updatedItems = state.items.map((item) =>
          cartLineKey(item) === lineKey
            ? { ...item, quantity: item.quantity + action.payload.quantity }
            : item
        );
        return { ...state, items: updatedItems, ...computeTotals(updatedItems) };
      }
      const newItems = [...state.items, payload];
      return { ...state, items: newItems, ...computeTotals(newItems) };
    }

    case 'REMOVE_ITEM': {
      const updatedItems = state.items.filter((item) => cartLineKey(item) !== action.payload);
      return { ...state, items: updatedItems, ...computeTotals(updatedItems) };
    }

    case 'UPDATE_QUANTITY': {
      const updatedItems = state.items
        .map((item) =>
          cartLineKey(item) === action.payload.id ? { ...item, quantity: action.payload.quantity } : item
        )
        .filter((item) => item.quantity > 0);
      return { ...state, items: updatedItems, ...computeTotals(updatedItems) };
    }

    case 'CLEAR_CART':
      return { items: [], total: 0, itemCount: 0 };

    case 'HYDRATE': {
      const items = action.payload.items.map(withCartLineId);
      return { items, ...computeTotals(items) };
    }

    case 'MERGE_SERVER': {
      const merged = mergeCartLines(action.payload.serverItems, state.items);
      return { items: merged, ...computeTotals(merged) };
    }

    default:
      return state;
  }
};

type CartCtx = {
  state: CartState;
  dispatch: React.Dispatch<CartAction>;
  clearPersistedCart: () => Promise<void>;
};

const CartContext = createContext<CartCtx | null>(null);

/** Never seed from guest localStorage here — Firebase restores session after first paint and guest → account bleed causes “ghost” lines after checkout. */
const cartInitialLazy = (): CartState => ({ items: [], total: 0, itemCount: 0 });

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(cartReducer, {}, cartInitialLazy);

  /** Wipe corrupted pre-fix cart keys once; then server + merge rebuild a clean cart if any. */
  useEffect(() => {
    migrateCartSchemaIfNeeded();
  }, []);

  const bootstrapKey = useRef<string>('');
  /** Prevents syncing an empty/edited cart to the server before the first load merges (wiped carts on new devices). */
  const serverSyncReadyRef = useRef<string>('');
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Signed-out users: hydrate from guest bucket only. */
  useEffect(() => {
    if (user?.email) return;
    migrateLegacyCartIfNeeded();
    const guest = readPersistedCartFromStorage(undefined);
    dispatch({ type: 'HYDRATE', payload: { items: guest } });
  }, [user?.email]);

  /** Signed-in but Prisma id not yet — clear any guest lines still in memory so they are not copied into the account key. */
  useEffect(() => {
    if (!user?.email || user.dbUserId) return;
    dispatch({ type: 'HYDRATE', payload: { items: [] } });
  }, [user?.email, user?.dbUserId]);

  /**
   * Merge server + account disk + guest bucket (assimilate anonymous cart once), then clear guest storage.
   */
  useEffect(() => {
    if (!user?.email || !user.dbUserId) {
      bootstrapKey.current = '';
      serverSyncReadyRef.current = '';
      return;
    }
    const canon = cartAccountEmail(user.email);
    const sessionKey = `${canon}:${user.dbUserId}`;
    if (bootstrapKey.current === sessionKey) {
      return;
    }
    bootstrapKey.current = sessionKey;
    serverSyncReadyRef.current = '';

    let cancelled = false;
    (async () => {
      try {
        const serverItems = await loadServerCart(user.email!, user.dbUserId!);
        if (cancelled) return;

        const fromAccount = readPersistedCartFromStorage(user.email);
        const fromGuest = readPersistedCartFromStorage(undefined);
        const mergedLocal = mergeCartLines(fromAccount, fromGuest);
        const merged = mergeCartLines(serverItems, mergedLocal);

        dispatch({ type: 'HYDRATE', payload: { items: merged } });
        writePersistedCartToStorage(merged, user.email);
        writePersistedCartToStorage([], undefined);

        const ok = await syncServerCart(user.email!, user.dbUserId!, merged);
        if (!ok && !cancelled) {
          console.warn('[cart] Saving cart to server failed after login/refresh.');
        }
      } catch (e) {
        console.warn('[cart] bootstrap failed', e);
      } finally {
        if (!cancelled) {
          serverSyncReadyRef.current = sessionKey;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.email, user?.dbUserId]);

  /** Persist: guest only when logged out; account only after bootstrap finished (never copy guest into account early). */
  useEffect(() => {
    const email = user?.email?.trim();
    const dbUserId = user?.dbUserId?.trim();
    const sessionKey = email && dbUserId ? `${cartAccountEmail(email)}:${dbUserId}` : '';

    if (!email) {
      writePersistedCartToStorage(state.items, undefined);
    } else if (sessionKey && serverSyncReadyRef.current === sessionKey) {
      writePersistedCartToStorage(state.items, email);
    }

    if (!email || !dbUserId) {
      return;
    }

    if (serverSyncReadyRef.current !== sessionKey) {
      return;
    }

    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      syncServerCart(email, dbUserId, state.items).then((ok) => {
        if (!ok) console.warn('[cart] autosave to server failed (check DB migration + api).');
      });
    }, SYNC_MS);

    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [state.items, user?.email, user?.dbUserId]);

  const clearPersistedCart = useCallback(async () => {
    dispatch({ type: 'CLEAR_CART' });
    clearPersistedCartLocal(user?.email);
    if (user?.email && user?.dbUserId) {
      await clearServerCart(user.email, user.dbUserId);
    }
  }, [user?.email, user?.dbUserId]);

  return (
    <CartContext.Provider value={{ state, dispatch, clearPersistedCart }}>{children}</CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
