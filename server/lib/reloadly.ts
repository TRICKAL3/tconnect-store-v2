/**
 * Reloadly API client — gift cards, airtime, utilities.
 * Docs: https://developers.reloadly.com/
 * Credentials: Developers → API Settings (sandbox + live) in Reloadly dashboard.
 */

export type ReloadlyProduct = 'giftcards' | 'airtime' | 'utilities';

const AUTH_URL = 'https://auth.reloadly.com/oauth/token';

const AUDIENCES: Record<ReloadlyProduct, { live: string; sandbox: string }> = {
  giftcards: {
    live: 'https://giftcards.reloadly.com',
    sandbox: 'https://giftcards-sandbox.reloadly.com',
  },
  airtime: {
    live: 'https://topups.reloadly.com',
    sandbox: 'https://topups-sandbox.reloadly.com',
  },
  utilities: {
    live: 'https://utilities.reloadly.com',
    sandbox: 'https://utilities-sandbox.reloadly.com',
  },
};

const ACCEPT_HEADERS: Record<ReloadlyProduct, string> = {
  giftcards: 'application/com.reloadly.giftcards-v1+json',
  airtime: 'application/com.reloadly.topups-v1+json',
  utilities: 'application/com.reloadly.utilities-v1+json',
};

type TokenCacheEntry = { token: string; expiresAt: number };
const tokenCache = new Map<string, TokenCacheEntry>();

function cleanEnv(raw: string | undefined): string {
  return String(raw || '')
    .replace(/^\uFEFF/, '')
    .replace(/[\r\n]+/g, '')
    .trim();
}

export function isReloadlySandbox(): boolean {
  const raw = cleanEnv(process.env.RELOADLY_SANDBOX);
  if (!raw) return true;
  return raw !== '0' && raw.toLowerCase() !== 'false';
}

export function isReloadlyConfigured(): boolean {
  return !!(getClientId() && getClientSecret());
}

function getClientId(): string {
  return cleanEnv(process.env.RELOADLY_CLIENT_ID);
}

function getClientSecret(): string {
  return cleanEnv(process.env.RELOADLY_CLIENT_SECRET);
}

export function getReloadlyBaseUrl(product: ReloadlyProduct): string {
  const env = isReloadlySandbox() ? 'sandbox' : 'live';
  return AUDIENCES[product][env];
}

function formatReloadlyAuthError(
  data: {
    message?: string;
    error?: string;
    error_description?: string;
    errorCode?: string;
  },
  status: number,
  audience: string
): string {
  const code = data.errorCode || data.error;
  const desc = data.error_description || data.message || '';

  if (code === 'INVALID_CREDENTIALS' || /invalid.?credential/i.test(desc)) {
    return (
      'Reloadly rejected your Client ID / Client Secret (INVALID_CREDENTIALS). ' +
      'In Reloadly → Developers → API Settings, switch to Sandbox, copy fresh credentials, ' +
      'update RELOADLY_CLIENT_ID and RELOADLY_CLIENT_SECRET in Vercel, then redeploy.'
    );
  }

  if (code === 'access_denied' || /service not enabled within domain/i.test(desc)) {
    const sandbox = isReloadlySandbox();
    return (
      `Reloadly access_denied: token audience does not match the API URL. ` +
      `RELOADLY_SANDBOX is ${sandbox ? 'true' : 'false'} (audience ${audience}). ` +
      `Use sandbox credentials with RELOADLY_SANDBOX=true, or live credentials with RELOADLY_SANDBOX=false.`
    );
  }

  return desc || data.error || `Reloadly auth failed (${status})`;
}

export async function getReloadlyAccessToken(product: ReloadlyProduct): Promise<string> {
  const audience = getReloadlyBaseUrl(product);
  const cacheKey = audience;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const clientId = getClientId();
  const clientSecret = getClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error('Reloadly is not configured. Set RELOADLY_CLIENT_ID and RELOADLY_CLIENT_SECRET.');
  }

  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      audience,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    message?: string;
    error?: string;
    error_description?: string;
    errorCode?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(formatReloadlyAuthError(data, res.status, audience));
  }

  const expiresIn = Number(data.expires_in) || 3600;
  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  });

  return data.access_token;
}

export async function reloadlyRequest<T = unknown>(
  product: ReloadlyProduct,
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const token = await getReloadlyAccessToken(product);
  const base = getReloadlyBaseUrl(product);
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: ACCEPT_HEADERS[product],
      'Content-Type': 'application/json',
    },
    body: options.body != null ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const err = json as { message?: string; error?: string; errorCode?: string; error_description?: string };
    const msg = err.message || err.error_description || err.error || `Reloadly API error ${res.status}`;
    if (/access.?denied/i.test(msg) || err.error === 'access_denied') {
      throw new Error(
        `${msg} — Check RELOADLY_SANDBOX matches your credentials (sandbox vs live). ` +
          `Current mode: ${isReloadlySandbox() ? 'sandbox' : 'live'}, base: ${base}`
      );
    }
    throw new Error(msg);
  }

  return json as T;
}

export async function reloadlyStatus(): Promise<{
  configured: boolean;
  sandbox: boolean;
  clientIdHint?: string;
  giftcards?: { ok: boolean; balance?: unknown; error?: string };
  airtime?: { ok: boolean; balance?: unknown; error?: string };
}> {
  const sandbox = isReloadlySandbox();
  const configured = isReloadlyConfigured();
  const clientId = getClientId();
  if (!configured) {
    return { configured: false, sandbox };
  }

  const out: Awaited<ReturnType<typeof reloadlyStatus>> = {
    configured: true,
    sandbox,
    clientIdHint: clientId ? `${clientId.slice(0, 4)}…${clientId.slice(-4)}` : undefined,
  };

  for (const product of ['giftcards', 'airtime'] as const) {
    try {
      const balance = await reloadlyRequest(product, '/accounts/balance');
      out[product] = { ok: true, balance };
    } catch (e: unknown) {
      out[product] = { ok: false, error: e instanceof Error ? e.message : 'Failed' };
    }
  }

  return out;
}

export type ReloadlyGiftCardProduct = {
  productId: number;
  productName: string;
  countryCode?: string;
  global?: boolean;
  senderFee?: number;
  discountPercentage?: number;
  denominationType?: string;
  recipientCurrencyCode?: string;
  minRecipientDenomination?: number;
  maxRecipientDenomination?: number;
  logoUrls?: string[];
};

export async function listGiftCardProducts(countryCode: string, size = 50, page = 1) {
  const cc = countryCode.trim().toUpperCase();
  return reloadlyRequest<{ content?: ReloadlyGiftCardProduct[] }>(
    'giftcards',
    `/countries/${encodeURIComponent(cc)}/products?size=${size}&page=${page}`
  );
}

export async function listGiftCardCountries() {
  return reloadlyRequest<unknown[]>('giftcards', '/countries');
}

export async function orderGiftCard(input: {
  productId: number;
  countryCode: string;
  quantity: number;
  unitPrice: number;
  customIdentifier: string;
  senderName: string;
  recipientEmail: string;
  recipientPhone?: { countryCode: string; phoneNumber: string };
}) {
  return reloadlyRequest('giftcards', '/orders', {
    method: 'POST',
    body: input,
  });
}

export async function getGiftCardRedeemCode(transactionId: number) {
  return reloadlyRequest('giftcards', `/orders/transactions/${transactionId}/cards`);
}

export async function listAirtimeOperators(countryCode: string) {
  const cc = countryCode.trim().toUpperCase();
  return reloadlyRequest<unknown[]>('airtime', `/operators/countries/${encodeURIComponent(cc)}`);
}

export async function sendAirtimeTopup(input: {
  operatorId: number | string;
  amount: string | number;
  useLocalAmount?: boolean;
  customIdentifier: string;
  recipientPhone: { countryCode: string; number: string };
  recipientEmail?: string;
}) {
  return reloadlyRequest('airtime', '/topups', {
    method: 'POST',
    body: {
      useLocalAmount: input.useLocalAmount ?? true,
      ...input,
      operatorId: String(input.operatorId),
      amount: String(input.amount),
    },
  });
}
