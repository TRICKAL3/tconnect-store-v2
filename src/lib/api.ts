import { getApiBase } from './getApiBase';

// Get API base dynamically (not at module load time)
// This ensures the meta tag is read after DOM is ready
const getApiBaseUrl = (): string => {
  const apiBase = getApiBase();
  
  // Log API base URL (only once per session)
  if (typeof window !== 'undefined' && !(window as any).__apiBaseLogged) {
    console.log('🔧 [API] API Base URL:', apiBase);
    if (apiBase.includes('localhost') && window.location.hostname !== 'localhost') {
      console.warn('⚠️ [API] WARNING: Using localhost API URL in production!');
    }
    (window as any).__apiBaseLogged = true;
  }
  
  return apiBase;
};

/** Parse response as JSON; returns null if body is not valid JSON (e.g. HTML error page). */
export async function safeParseJson<T = unknown>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text || !text.trim()) return null;
  if (!text.trimStart().startsWith('{') && !text.trimStart().startsWith('[')) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export interface ApiProduct {
  id: string;
  name: string;
  category: string;
  type: 'giftcard' | 'crypto' | 'wallet' | 'virtual-card' | string;
  priceUsd: number;
  image?: string;
  description?: string;
  inStock: boolean;
}

export interface ApiRate {
  id: string;
  type: 'giftcard' | 'crypto' | 'wallet' | string;
  value: number;
}

/** JSON body; detects HTML (SPA index / 404 page) which breaks res.json(). */
async function parseJsonOrExplain<T>(res: Response, url: string, label: string): Promise<T> {
  const text = await res.text();
  const start = text.trimStart();
  if (start.startsWith('<') || start.startsWith('<!')) {
    throw new Error(
      `${label}: got HTML instead of JSON at ${url}. Start the backend (\`npm run local\`). If testing from another PC/phone IP, set REACT_APP_API_BASE to your API URL and rebuild.`
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`${label}: invalid JSON from ${url} (${msg})`);
  }
}

async function fetchWithRetry(url: string, retries = 5): Promise<Response> {
  let last: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url);
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 400 + i * 300));
    }
  }
  throw last;
}

export async function fetchProducts(): Promise<ApiProduct[]> {
  const url = `${getApiBaseUrl()}/products`;
  let res: Response;
  try {
    res = await fetchWithRetry(url);
  } catch (e: unknown) {
    const hint =
      ' Start the backend on :4001 (`npm run local` or `npm run backend:dev`). On localhost the app loads the API via /api (CRA proxy); if it still fails, try setting REACT_APP_API_BASE=http://127.0.0.1:4001 and restart.';
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Network error loading products (${msg}).${hint}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail = text.slice(0, 280);
    try {
      const j = JSON.parse(text) as { error?: string; message?: string };
      detail = String(j?.error ?? j?.message ?? detail);
    } catch {
      /* keep truncated body */
    }
    throw new Error(
      `Products request failed (${res.status} ${res.statusText}). ${detail || `GET ${url}`}`.trim()
    );
  }
  const data = await parseJsonOrExplain<unknown>(res, url, 'Products');
  if (!Array.isArray(data)) {
    throw new Error(`Products: expected JSON array from ${url}`);
  }
  return data as ApiProduct[];
}

export async function fetchProductById(id: string): Promise<ApiProduct> {
  const url = `${getApiBaseUrl()}/products/${encodeURIComponent(id)}`;
  let res: Response;
  try {
    res = await fetchWithRetry(url);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Network error loading product (${msg}).`);
  }
  if (!res.ok) {
    if (res.status === 404) throw new Error('Product not found');
    const text = await res.text().catch(() => '');
    throw new Error(`Product request failed (${res.status}). ${text.slice(0, 200)}`.trim());
  }
  const data = await parseJsonOrExplain<unknown>(res, url, 'Product');
  if (!data || typeof data !== 'object' || !('id' in (data as object))) {
    throw new Error(`Product: expected object from ${url}`);
  }
  return data as ApiProduct;
}

export async function fetchRates(): Promise<ApiRate[]> {
  const url = `${getApiBaseUrl()}/rates`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load rates');
  const data = await parseJsonOrExplain<unknown>(res, url, 'Rates');
  if (!Array.isArray(data)) {
    throw new Error(`Rates: expected JSON array from ${url}`);
  }
  return data as ApiRate[];
}


