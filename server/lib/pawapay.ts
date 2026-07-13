/**
 * PawaPay v2 Payment Page + deposit status. Env: PAWAPAY_API_TOKEN, PAWAPAY_MODE (sandbox|live),
 * PAWAPAY_CALLBACK_API_BASE, FRONTEND_URL, optional PAWAPAY_COUNTRY (default MWI).
 */

const SANDBOX_API = 'https://api.sandbox.pawapay.io';
const LIVE_API = 'https://api.pawapay.io';

export function getPawapayApiToken(): string {
  return String(process.env.PAWAPAY_API_TOKEN || '').trim();
}

export function getPawapayApiBase(): string {
  const mode = String(process.env.PAWAPAY_MODE || 'live').trim().toLowerCase();
  return mode === 'sandbox' ? SANDBOX_API : LIVE_API;
}

export function getPawapayCallbackApiBase(): string {
  const raw = String(
    process.env.PAWAPAY_CALLBACK_API_BASE || process.env.PUBLIC_API_BASE || ''
  ).trim();
  return raw.replace(/\/+$/, '');
}

export function getPawapayCountry(): string {
  return String(process.env.PAWAPAY_COUNTRY || 'MWI').trim().toUpperCase() || 'MWI';
}

export function getFrontendBaseUrl(): string {
  const raw = String(
    process.env.FRONTEND_URL || process.env.REACT_APP_PUBLIC_URL || 'http://localhost:3000'
  ).trim();
  return raw.replace(/\/+$/, '');
}

export { getPawapayReturnUrl, getPawapayReturnUrlFor } from './pawapayReturn';

/** True only when a real-looking API token is set (not empty / placeholder text). */
export function isPawapayConfigured(): boolean {
  const token = getPawapayApiToken();
  if (!token || token.length < 16) return false;
  if (/paste|your_.*token|placeholder|example|xxx|changeme/i.test(token)) return false;
  return true;
}

/** Map PawaPay HTTP/body errors to checkout-safe messages. */
export function userMessageForPawapayError(message: string, httpStatus?: number): string {
  const m = message.toLowerCase();
  if (m.includes('unsupported parameter')) {
    return 'Payment could not be started due to a configuration issue. Please try again or contact support.';
  }
  if (m.includes('returnurl') && m.includes('invalid')) {
    return (
      'PawaPay rejected the return URL. Set PAWAPAY_RETURN_URL=https://your-live-store/checkout in backend/.env ' +
      '(HTTPS only — not localhost). Use your Vercel site or ngrok https://xxx.ngrok-free.app/checkout for local tests.'
    );
  }
  if (
    (m.includes('invalid') && m.includes('token')) ||
    m.includes('authentication') ||
    m.includes('unauthorized') ||
    httpStatus === 401 ||
    httpStatus === 403
  ) {
    return (
      'PawaPay rejected the API token. In Vercel → Environment Variables: set PAWAPAY_API_TOKEN to the raw token only ' +
      '(no quotes, no "Bearer "). Use PAWAPAY_MODE=live with a LIVE token from dashboard.pawapay.io, or ' +
      'PAWAPAY_MODE=sandbox with a SANDBOX token — they must match. Redeploy after saving. ' +
      'Check: /api/payments/pawapay/status'
    );
  }
  if (message && message.length < 220) return message;
  if (httpStatus && httpStatus >= 500) return 'PawaPay is temporarily unavailable. Try again shortly.';
  return 'Could not start mobile money payment. Check your PawaPay token and try again.';
}

type PawapayJson = Record<string, unknown>;

function pickString(obj: PawapayJson | undefined, ...keys: string[]): string | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/** Lightweight auth check — NOT_FOUND means token accepted; 401/403 means wrong token or mode. */
export async function pawapayProbeApiToken(): Promise<{
  ok: boolean;
  authOk: boolean;
  httpStatus?: number;
  apiBase: string;
  mode: string;
  hint?: string;
}> {
  const token = getPawapayApiToken();
  const mode = String(process.env.PAWAPAY_MODE || 'live').trim().toLowerCase();
  const apiBase = getPawapayApiBase();
  if (!token) {
    return { ok: true, authOk: false, apiBase, mode, hint: 'PAWAPAY_API_TOKEN is not set' };
  }

  const probeId = '00000000-0000-4000-8000-000000000001';
  try {
    const res = await fetch(`${apiBase}/v2/deposits/${probeId}`, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 || res.status === 403) {
      return {
        ok: true,
        authOk: false,
        httpStatus: res.status,
        apiBase,
        mode,
        hint:
          mode === 'live'
            ? 'Token rejected on LIVE API — use a production token and PAWAPAY_MODE=live, or switch to sandbox token + PAWAPAY_MODE=sandbox'
            : 'Token rejected on SANDBOX API — use a sandbox token and PAWAPAY_MODE=sandbox, or switch to live token + PAWAPAY_MODE=live',
      };
    }
    return { ok: true, authOk: true, httpStatus: res.status, apiBase, mode };
  } catch (e: unknown) {
    return {
      ok: false,
      authOk: false,
      apiBase,
      mode,
      hint: e instanceof Error ? e.message : 'Could not reach PawaPay API',
    };
  }
}

export async function pawapayInitiatePaymentPage(params: {
  depositId: string;
  returnUrl: string;
  amountMwk: number;
  reason: string;
  country?: string;
  orderId?: string;
}): Promise<{
  ok: boolean;
  redirectUrl?: string;
  status?: string;
  message?: string;
  raw?: PawapayJson;
}> {
  const token = getPawapayApiToken();
  if (!token) return { ok: false, message: 'payment_service_not_configured' };

  const amount = String(Math.max(1, Math.round(params.amountMwk)));
  // Payment Page API only accepts: depositId, returnUrl, reason, country, amountDetails, msisdn (optional).
  // clientReferenceId/metadata belong on direct /v2/deposits, not paymentpage.
  const body: PawapayJson = {
    depositId: params.depositId,
    returnUrl: params.returnUrl,
    reason: params.reason.slice(0, 200),
    country: params.country || getPawapayCountry(),
    amountDetails: {
      amount,
      currency: 'MWK',
    },
  };

  const res = await fetch(`${getPawapayApiBase()}/v2/paymentpage`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  let json: PawapayJson = {};
  try {
    json = (await res.json()) as PawapayJson;
  } catch {
    return { ok: false, message: 'payment_page_parse_failed' };
  }

  const status = pickString(json, 'status') || '';
  const redirectUrl = pickString(json, 'redirectUrl', 'redirectURL');
  const failure = json.failureReason as PawapayJson | undefined;
  const failureMsg =
    pickString(failure, 'failureMessage') || pickString(json, 'message') || pickString(json, 'error');

  if (!res.ok) {
    const msg = failureMsg || `payment_page_http_${res.status}`;
    return {
      ok: false,
      message: userMessageForPawapayError(msg, res.status),
      raw: json,
    };
  }

  if (status === 'REJECTED') {
    return { ok: false, message: failureMsg || 'payment_rejected', raw: json };
  }

  if (!redirectUrl) {
    return { ok: false, message: failureMsg || 'missing_redirect_url', raw: json };
  }

  return { ok: true, redirectUrl, status: status || 'ACCEPTED', raw: json };
}

/** Deposit statuses that mean the customer has paid (PawaPay may use COMPLETED or SUCCESS). */
export function isPawapayDepositCompleted(status: string): boolean {
  const s = String(status || '').trim().toUpperCase();
  return s === 'COMPLETED' || s === 'SUCCESS' || s === 'ACCEPTED';
}

/** Still in flight — safe to retry verify after return from Payment Page. */
export function isPawapayDepositProcessing(status: string): boolean {
  const s = String(status || '').trim().toUpperCase();
  return (
    s === 'PROCESSING' ||
    s === 'PENDING' ||
    s === 'SUBMITTED' ||
    s === 'IN_PROGRESS'
  );
}

export type PawapayDepositInfo = {
  depositId: string;
  status: string;
  amount?: string;
  currency?: string;
  providerTransactionId?: string;
};

export async function pawapayCheckDepositStatus(depositId: string): Promise<{
  ok: boolean;
  found: boolean;
  deposit?: PawapayDepositInfo;
  message?: string;
}> {
  const token = getPawapayApiToken();
  if (!token) return { ok: false, found: false, message: 'payment_service_not_configured' };

  const res = await fetch(
    `${getPawapayApiBase()}/v2/deposits/${encodeURIComponent(depositId)}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  );

  let json: PawapayJson = {};
  try {
    json = (await res.json()) as PawapayJson;
  } catch {
    return { ok: false, found: false, message: 'status_parse_failed' };
  }

  if (!res.ok) {
    const msg = pickString(json, 'message') || pickString(json, 'error') || `http_${res.status}`;
    return { ok: false, found: false, message: msg };
  }

  const envelopeStatus = pickString(json, 'status') || '';
  const data = (json.data as PawapayJson | undefined) || json;
  const depositStatus = pickString(data, 'status') || envelopeStatus;

  if (envelopeStatus === 'NOT_FOUND' || depositStatus === 'NOT_FOUND') {
    return { ok: true, found: false };
  }

  return {
    ok: true,
    found: true,
    deposit: {
      depositId: pickString(data, 'depositId') || depositId,
      status: depositStatus || 'UNKNOWN',
      amount: pickString(data, 'amount', 'depositedAmount', 'requestedAmount') || undefined,
      currency: pickString(data, 'currency') || undefined,
      providerTransactionId: pickString(data, 'providerTransactionId') || undefined,
    },
  };
}

/** Parse deposit callback POST body from PawaPay. */
export function parsePawapayCallbackBody(body: unknown): PawapayDepositInfo | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as PawapayJson;
  const depositId = pickString(b, 'depositId');
  const status = pickString(b, 'status');
  if (!depositId || !status) return null;
  return {
    depositId,
    status,
    amount: pickString(b, 'depositedAmount', 'requestedAmount', 'amount') || undefined,
    currency: pickString(b, 'currency') || undefined,
    providerTransactionId:
      (b.correspondentIds as PawapayJson | undefined)?.MTN_FINAL != null
        ? String((b.correspondentIds as PawapayJson).MTN_FINAL)
        : undefined,
  };
}
