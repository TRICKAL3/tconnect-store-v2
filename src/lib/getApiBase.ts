// Safe API base selection:
// - Localhost: `/api` unless REACT_APP_API_BASE is set (CRA proxy → :4001).
// - Production (not localhost): `/api` same-origin (Vercel serverless) by default so routes like /cart work.
// - Opt-in external API: REACT_APP_USE_EXTERNAL_API=true plus REACT_APP_API_BASE=https://your-railway...

export const getApiBase = (): string => {
  const env = process.env.REACT_APP_API_BASE?.trim();
  const external =
    String(process.env.REACT_APP_USE_EXTERNAL_API || '')
      .trim()
      .toLowerCase() === 'true';
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLocalHost = host === 'localhost' || host === '127.0.0.1';

  if (isLocalHost) {
    if (env && env.length > 0) {
      return env.replace(/\/+$/, '');
    }
    return '/api';
  }

  if (external && env && env.length > 0) {
    const lowered = env.toLowerCase();
    if (!lowered.includes('localhost') && !lowered.includes('127.0.0.1')) {
      return env.replace(/\/+$/, '');
    }
  }

  return '/api';
};

/** Placeholder when product has no image (avoids broken img src). */
export const GIFT_CARD_PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="128" viewBox="0 0 160 128"><rect fill="%231a1a2e" width="160" height="128"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23666" font-size="14" font-family="sans-serif">No image</text></svg>'
);

/** Turn product image into an absolute URL. Supports full URLs, same-origin paths, API base, and Supabase storage paths. */
export const getAbsoluteImageUrl = (image: string | null | undefined): string => {
  if (!image || typeof image !== 'string') return '';
  const trimmed = image.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (typeof window === 'undefined') return trimmed;
  // Supabase storage path (e.g. "steam.png" or "gaming/steam.png") -> public URL
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const supabaseBucket = process.env.REACT_APP_SUPABASE_STORAGE_BUCKET || 'products';
  if (supabaseUrl && !trimmed.startsWith('/')) {
    const base = supabaseUrl.replace(/\/+$/, '');
    return `${base}/storage/v1/object/public/${supabaseBucket}/${trimmed}`;
  }
  const path = trimmed.startsWith('/') ? trimmed : '/' + trimmed;
  const useApiBase = path.startsWith('/api/') || !trimmed.startsWith('/');
  if (useApiBase) {
    const apiBase = getApiBase();
    if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
      return apiBase.replace(/\/+$/, '') + path;
    }
    const base = (apiBase.startsWith('/') ? apiBase : '/api').replace(/\/+$/, '');
    return window.location.origin + base + path;
  }
  return window.location.origin + path;
};

