import { getPaychanguSecret } from './paychangu';

const PAYCHANGU_API = 'https://api.paychangu.com';

function authHeaders(): Record<string, string> {
  const secret = getPaychanguSecret();
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${secret}`,
  };
}

export type PaychanguOperator = {
  id: number;
  name: string;
  ref_id: string;
  short_code: string;
};

export async function paychanguGetOperators(): Promise<{
  ok: boolean;
  operators?: PaychanguOperator[];
  message?: string;
}> {
  const secret = getPaychanguSecret();
  if (!secret) return { ok: false, message: 'payment_service_not_configured' };

  const res = await fetch(`${PAYCHANGU_API}/mobile-money/`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${secret}` },
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, message: 'operators_parse_failed' };
  }
  if (!res.ok || String(json.status || '').toLowerCase() !== 'success') {
    return { ok: false, message: typeof json.message === 'string' ? json.message : 'operators_failed' };
  }
  const data = Array.isArray(json.data) ? (json.data as PaychanguOperator[]) : [];
  return { ok: true, operators: data };
}

export async function paychanguChargeMobileMoney(input: {
  mobile: string;
  operatorRefId: string;
  amountMwk: number;
  chargeId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}): Promise<{ ok: boolean; data?: Record<string, unknown>; message?: string }> {
  const secret = getPaychanguSecret();
  if (!secret) return { ok: false, message: 'payment_service_not_configured' };

  const payload = {
    mobile: input.mobile,
    mobile_money_operator_ref_id: input.operatorRefId,
    amount: String(Math.max(1, Math.round(input.amountMwk))),
    charge_id: input.chargeId,
    email: input.email,
    first_name: input.firstName,
    last_name: input.lastName,
  };

  const res = await fetch(`${PAYCHANGU_API}/mobile-money/payments/initialize`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, message: 'charge_parse_failed' };
  }

  if (!res.ok || String(json.status || '').toLowerCase() !== 'success') {
    return { ok: false, message: formatPaychanguApiMessage(json.message, 'charge_failed'), data: json };
  }

  const data = json.data as Record<string, unknown> | undefined;
  return { ok: true, data: data || json };
}

export async function paychanguVerifyMobileMoneyCharge(chargeId: string): Promise<{
  ok: boolean;
  paid?: boolean;
  data?: Record<string, unknown>;
  message?: string;
}> {
  const secret = getPaychanguSecret();
  if (!secret) return { ok: false, message: 'payment_service_not_configured' };

  const res = await fetch(
    `${PAYCHANGU_API}/mobile-money/payments/${encodeURIComponent(chargeId)}/verify`,
    { headers: { Accept: 'application/json', Authorization: `Bearer ${secret}` } }
  );

  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, message: 'verify_parse_failed' };
  }

  const topStatus = String(json.status || '').toLowerCase();
  const data = json.data as Record<string, unknown> | undefined;
  const innerStatus = String(data?.status || '').toLowerCase();
  const paid =
    topStatus === 'successful' ||
    topStatus === 'success' ||
    innerStatus === 'success' ||
    innerStatus === 'successful';

  if (!res.ok && !paid) {
    return { ok: false, message: typeof json.message === 'string' ? json.message : 'verify_failed', data };
  }

  return { ok: true, paid, data: data || json };
}

/** PayChangu verify API requires the full charge id (e.g. momo-uuid), not the uuid alone. */
export function normalizeMomoChargeId(chargeId: string): string {
  const id = String(chargeId || '').trim();
  if (!id) return id;
  return id.startsWith('momo-') ? id : `momo-${id}`;
}

export function momoChargeIdVariants(chargeId: string): string[] {
  const id = String(chargeId || '').trim();
  if (!id) return [];
  const withPrefix = normalizeMomoChargeId(id);
  const withoutPrefix = withPrefix.replace(/^momo-/, '');
  return [...new Set([id, withPrefix, withoutPrefix])];
}

/** PayChangu direct charge expects a local Malawi number (e.g. 0991234567), not +265…. */
export function normalizeMalawiMobile(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';

  let national = digits;
  if (national.startsWith('265') && national.length >= 12) {
    national = national.slice(3);
  }
  if (national.startsWith('0') && national.length > 9) {
    national = national.slice(1);
  }
  if (national.startsWith('0') && national.length === 10) {
    return national;
  }
  if (national.length === 9) {
    return `0${national}`;
  }
  return '';
}

/** Turn PayChangu validation payloads into a readable string for the client. */
export function formatPaychanguApiMessage(message: unknown, fallback: string): string {
  if (typeof message === 'string' && message.trim()) return message.trim();
  if (message && typeof message === 'object') {
    const parts: string[] = [];
    for (const [key, val] of Object.entries(message as Record<string, unknown>)) {
      if (Array.isArray(val)) {
        val.forEach((v) => {
          if (typeof v === 'string' && v.trim()) parts.push(v.trim());
        });
      } else if (typeof val === 'string' && val.trim()) {
        parts.push(`${key}: ${val.trim()}`);
      }
    }
    if (parts.length) return parts.join(' ');
  }
  return fallback;
}
