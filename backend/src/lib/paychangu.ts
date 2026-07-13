/**
 * Hosted payment checkout (server-side secret + verify). Env: PAYCHANGU_SECRET_KEY,
 * PAYCHANGU_CALLBACK_API_BASE (public API root for webhooks), FRONTEND_URL.
 */

const PAYCHANGU_API = 'https://api.paychangu.com';

function cleanEnvValue(raw: string | undefined): string {
  return String(raw || '')
    .replace(/^\uFEFF/, '')
    .replace(/[\r\n]+/g, '')
    .trim();
}

export function getPaychanguSecret(): string {
  return cleanEnvValue(process.env.PAYCHANGU_SECRET_KEY);
}

/** Public base URL of this API as the payment processor can reach it (for callbacks). */
export function getPaychanguCallbackApiBase(): string {
  const raw = cleanEnvValue(process.env.PAYCHANGU_CALLBACK_API_BASE || process.env.PUBLIC_API_BASE);
  return raw.replace(/\/+$/, '');
}

export function getFrontendBaseUrl(): string {
  let raw = cleanEnvValue(process.env.FRONTEND_URL || process.env.REACT_APP_PUBLIC_URL);
  if (!raw && process.env.VERCEL === '1') {
    raw = cleanEnvValue(process.env.VERCEL_PROJECT_PRODUCTION_URL) || 'https://www.tconnect.store';
  }
  if (!raw) raw = 'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

export function isPlaceholderGuestEmail(email: string | null | undefined): boolean {
  if (!email) return true;
  return /guest\+|unknown\.local/i.test(email);
}

export async function paychanguVerifyPayment(txRef: string): Promise<{
  ok: boolean;
  data?: Record<string, unknown>;
  message?: string;
}> {
  const secret = getPaychanguSecret();
  if (!secret) return { ok: false, message: 'payment_service_not_configured' };

  const res = await fetch(`${PAYCHANGU_API}/verify-payment/${encodeURIComponent(txRef)}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${secret}`,
    },
  });

  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, message: 'payment_verify_parse_failed' };
  }

  if (!res.ok || String(json.status || '').toLowerCase() !== 'success') {
    const msg = typeof json.message === 'string' ? json.message : 'Verification failed';
    return { ok: false, message: msg, data: json };
  }

  const inner = json.data as Record<string, unknown> | undefined;
  if (!inner || String(inner.status || '').toLowerCase() !== 'success') {
    return { ok: false, message: 'Payment not successful', data: json };
  }

  return { ok: true, data: inner };
}

export function parsePaychanguInitiateResponse(json: Record<string, unknown>): {
  checkoutUrl: string | null;
  txRef: string | null;
} {
  const data = json.data as Record<string, unknown> | undefined;
  const checkoutUrl =
    (data?.checkout_url as string) ||
    ((data?.data as Record<string, unknown> | undefined)?.checkout_url as string) ||
    null;
  const inner = (data?.data as Record<string, unknown> | undefined) || data;
  const txRef = (inner?.tx_ref as string) || (data?.tx_ref as string) || null;
  return { checkoutUrl, txRef };
}

/**
 * Map initiate-payment failures to a safe client message. Always log `pcJson` server-side for debugging.
 */
export function userMessageForPaychanguInitiateFailure(
  pcRes: { ok: boolean; status: number },
  pcJson: Record<string, unknown>
): string {
  const apiMsg = typeof pcJson.message === 'string' ? pcJson.message.trim() : '';
  const blob = `${apiMsg} ${JSON.stringify(pcJson)}`.toLowerCase();

  if (
    blob.includes('callback') ||
    blob.includes('return_url') ||
    blob.includes('127.0.0.1') ||
    blob.includes('localhost') ||
    blob.includes('invalid url') ||
    blob.includes('must be https') ||
    blob.includes('not reachable')
  ) {
    return 'Add money doesn’t work from a private copy of the site on your computer. Open your real store link (after deploy), or test top-up there first.';
  }

  if (!pcRes.ok && pcRes.status >= 500) {
    return 'The payment service returned an error. Try again in a few minutes.';
  }

  if (apiMsg && apiMsg.length > 0 && apiMsg.length < 220) {
    return apiMsg;
  }

  return 'Something went wrong starting payment. Try again, or use your live store link.';
}
