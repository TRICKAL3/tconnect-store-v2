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
  CART_LS_KEY,
  readPersistedCartFromStorage,
  writePersistedCartToStorage,
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

const cartInitialLazy = (): CartState => {
  const parsed = readPersistedCartFromStorage();
  if (!parsed.length) return { items: [], total: 0, itemCount: 0 };
  return { items: parsed, ...computeTotals(parsed) };
};

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(cartReducer, {}, cartInitialLazy);

  const bootstrapKey = useRef<string>('');
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Merge server snapshot with what's in localStorage (source of truth for refresh),
   * then push unified cart to DB so Admin can see it.
   */
  useEffect(() => {
    if (!user?.email || !user.dbUserId) {
      bootstrapKey.current = '';
      return;
    }
    const canon = cartAccountEmail(user.email);
    const key = `${canon}:${user.dbUserId}`;
    if (bootstrapKey.current === key) return;
    bootstrapKey.current = key;

    let cancelled = false;
    (async () => {
      try {
        const serverItems = await loadServerCart(user.email!, user.dbUserId!);
        if (cancelled) return;

        const fromDisk = readPersistedCartFromStorage();
        const merged = mergeCartLines(serverItems, fromDisk);

        dispatch({ type: 'HYDRATE', payload: { items: merged } });
        writePersistedCartToStorage(merged);

        const ok = await syncServerCart(user.email!, user.dbUserId!, merged);
        if (!ok && !cancelled) {
          console.warn('[cart] Saving cart to server failed after login/refresh.');
        }
      } catch (e) {
        console.warn('[cart] bootstrap failed', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.email, user?.dbUserId]);

  /** Persist to browser + debounced sync for edits */
  useEffect(() => {
    writePersistedCartToStorage(state.items);

    if (!user?.email || !user.dbUserId) {
      return;
    }

    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      syncServerCart(user.email!, user.dbUserId!, state.items).then((ok) => {
        if (!ok) console.warn('[cart] autosave to server failed (check DB migration + api).');
      });
    }, SYNC_MS);

    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [state.items, user?.email, user?.dbUserId]);

  const clearPersistedCart = useCallback(async () => {
    dispatch({ type: 'CLEAR_CART' });
    try {
      localStorage.removeItem(CART_LS_KEY);
    } catch {
      /* ignore */
    }
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
