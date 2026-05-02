import { getApiBase } from './getApiBase';
import type { CartItem } from './cartTypes';
import { cartAccountEmail } from './cartIdentity';

async function cartJson<T>(label: string, res: Response): Promise<T | null> {
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const txt = await res.text();
      if (txt)
        detail += `: ${txt.slice(0, 400)}`;
    } catch {
      /* ignore */
    }
    console.warn(`[cart] ${label} failed`, detail);
    return null;
  }
  try {
    return (await res.json()) as T;
  } catch {
    console.warn(`[cart] ${label}: invalid JSON`);
    return null;
  }
}

export async function loadServerCart(email: string, userDbId: string): Promise<CartItem[]> {
  const base = getApiBase();
  const em = cartAccountEmail(email);
  const res = await fetch(`${base}/cart/load`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: em, userDbId }),
  });
  const data = await cartJson<{ items?: CartItem[] }>('load', res);
  if (!data?.items || !Array.isArray(data.items)) return [];
  return data.items as CartItem[];
}

export async function syncServerCart(
  email: string,
  userDbId: string,
  items: CartItem[],
  retries = 2
): Promise<boolean> {
  const base = getApiBase();
  const em = cartAccountEmail(email);
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${base}/cart/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: em, userDbId, items }),
    });
    if (res.ok) return true;
    await cartJson('sync', res);
    await new Promise((r) => setTimeout(r, 280 + attempt * 200));
  }
  return false;
}

export async function clearServerCart(email: string, userDbId: string): Promise<boolean> {
  const base = getApiBase();
  const em = cartAccountEmail(email);
  const res = await fetch(`${base}/cart/clear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: em, userDbId }),
  });
  return res.ok;
}
