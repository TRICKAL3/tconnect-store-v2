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



export async function paychanguGetBillers(): Promise<{ ok: boolean; billers?: unknown[]; message?: string }> {

  const secret = getPaychanguSecret();

  if (!secret) return { ok: false, message: 'payment_service_not_configured' };



  const res = await fetch(`${PAYCHANGU_API}/bills/getBillers`, { headers: authHeaders() });

  let json: Record<string, unknown> = {};

  try {

    json = (await res.json()) as Record<string, unknown>;

  } catch {

    return { ok: false, message: 'billers_parse_failed' };

  }

  const data = json.data as Record<string, unknown> | undefined;

  const billers = Array.isArray(data?.billers) ? data!.billers : [];

  if (!res.ok && !json.success) {

    return { ok: false, message: typeof json.message === 'string' ? json.message : 'billers_failed' };

  }

  return { ok: true, billers };

}



export async function paychanguValidateBill(input: {

  biller: string;

  account: string;

  accountType?: string;

  amount?: string;

}): Promise<{ ok: boolean; data?: Record<string, unknown>; message?: string }> {

  const secret = getPaychanguSecret();

  if (!secret) return { ok: false, message: 'payment_service_not_configured' };



  const body: Record<string, string> = {

    biller: input.biller,

    account: input.account,

  };

  if (input.accountType) body.account_type = input.accountType;

  if (input.amount) body.amount = input.amount;



  const res = await fetch(`${PAYCHANGU_API}/bills/validate`, {

    method: 'POST',

    headers: authHeaders(),

    body: JSON.stringify(body),

  });



  let json: Record<string, unknown> = {};

  try {

    json = (await res.json()) as Record<string, unknown>;

  } catch {

    return { ok: false, message: 'validate_parse_failed' };

  }

  if (
    json.success === false ||
    (!res.ok && json.success !== true && String(json.status || '').toLowerCase() !== 'success')
  ) {
    return { ok: false, message: typeof json.message === 'string' ? json.message : 'validate_failed', data: json };
  }

  const rawData = json.data;
  const data =
    rawData && typeof rawData === 'object' && !Array.isArray(rawData)
      ? (rawData as Record<string, unknown>)
      : (json as Record<string, unknown>);

  return {
    ok: true,
    data,
    message: typeof json.message === 'string' ? json.message : undefined,
  };

}



export async function paychanguPayBill(input: {

  biller: string;

  account: string;

  amount?: string;

  customerName?: string;

  accountType?: string;

  reference: string;

}): Promise<{ ok: boolean; data?: Record<string, unknown>; message?: string }> {

  const secret = getPaychanguSecret();

  if (!secret) return { ok: false, message: 'payment_service_not_configured' };



  const body: Record<string, string> = {

    biller: input.biller,

    account: input.account,

    reference: input.reference,

  };

  if (input.amount) body.amount = input.amount;

  if (input.customerName) body.customer_name = input.customerName;

  if (input.accountType) body.account_type = input.accountType;



  const res = await fetch(`${PAYCHANGU_API}/bills/pay`, {

    method: 'POST',

    headers: authHeaders(),

    body: JSON.stringify(body),

  });



  let json: Record<string, unknown> = {};

  try {

    json = (await res.json()) as Record<string, unknown>;

  } catch {

    return { ok: false, message: 'pay_bill_parse_failed' };

  }



  const ok =

    res.ok ||

    json.success === true ||

    String(json.status || '').toLowerCase() === 'success';

  if (!ok) {

    return { ok: false, message: typeof json.message === 'string' ? json.message : 'pay_bill_failed', data: json };

  }

  const data = (json.data as Record<string, unknown> | undefined) || json;

  return { ok: true, data };

}



/** Fetch bill payment details (includes ESCOM token) by our payment reference. */

export async function paychanguGetBillTransaction(

  reference: string

): Promise<{ ok: boolean; data?: Record<string, unknown>; message?: string }> {

  const secret = getPaychanguSecret();

  if (!secret) return { ok: false, message: 'payment_service_not_configured' };



  const ref = String(reference || '').trim();

  if (!ref) return { ok: false, message: 'reference_required' };



  const res = await fetch(`${PAYCHANGU_API}/bills/getTransactions/${encodeURIComponent(ref)}`, {

    headers: { Accept: 'application/json', Authorization: `Bearer ${secret}` },

  });



  let json: Record<string, unknown> = {};

  try {

    json = (await res.json()) as Record<string, unknown>;

  } catch {

    return { ok: false, message: 'bill_transaction_parse_failed' };

  }



  const ok =

    res.ok ||

    json.success === true ||

    String(json.status || '').toLowerCase() === 'success';

  if (!ok) {

    return {

      ok: false,

      message: typeof json.message === 'string' ? json.message : 'bill_transaction_failed',

      data: json,

    };

  }

  const data = (json.data as Record<string, unknown> | undefined) || json;

  return { ok: true, data };

}



/** True when value is our merchant reference, not an electricity token. */

export function isMerchantBillReference(value: string | null | undefined): boolean {

  const v = String(value || '').trim();

  if (!v) return false;

  if (/^TC-[a-f0-9]{6,}-[a-f0-9]{4,}$/i.test(v)) return true;

  if (/^TC-[a-f0-9-]+$/i.test(v)) return true;

  return false;

}



function isLikelyPersonName(value: string): boolean {
  const v = value.trim();
  if (v.length < 2 || v.length > 120) return false;
  if (/^\d+$/.test(v)) return false;
  if (/^TC-/i.test(v)) return false;
  if (v.includes('@')) return false;
  if (/^(success|ok|pending|failed|validate|validation|escom|llwb|masm|mra)$/i.test(v)) return false;
  return /[A-Za-z]{2,}/.test(v);
}

function keyLooksLikeNameField(key: string): boolean {
  const k = key.toLowerCase();
  if (['biller', 'account', 'amount', 'currency', 'status', 'type', 'message'].includes(k)) return false;
  return (
    k.includes('name') ||
    k.includes('customer') ||
    k.includes('holder') ||
    k.includes('owner') ||
    k.includes('consumer') ||
    k.includes('member') ||
    k === 'validation' ||
    k === 'label' ||
    k === 'description'
  );
}

function extractNameFromApiMessage(message: string | null | undefined): string | null {
  if (!message) return null;
  const patterns = [
    /\bfor\s+(.+)$/i,
    /\bbelongs?\s+to\s+(.+)$/i,
    /\bname[:\s]+(.+)$/i,
    /\bvalidated[:\s]+(.+)$/i,
    /\baccount[:\s]+(.+)$/i,
  ];
  for (const re of patterns) {
    const m = message.match(re);
    if (m?.[1] && isLikelyPersonName(m[1])) return m[1].trim();
  }
  return null;
}

function walkForCustomerName(node: unknown, depth = 0): string | null {
  if (depth > 12 || node == null) return null;

  if (typeof node === 'string') {
    return isLikelyPersonName(node) ? node.trim() : null;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = walkForCustomerName(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof node !== 'object') return null;
  const obj = node as Record<string, unknown>;

  const first = obj.first_name ?? obj.firstName ?? obj.firstname;
  const last = obj.last_name ?? obj.lastName ?? obj.lastname;
  if (typeof first === 'string' && first.trim()) {
    const full = [first.trim(), typeof last === 'string' ? last.trim() : ''].filter(Boolean).join(' ');
    if (isLikelyPersonName(full)) return full;
  }

  for (const [key, val] of Object.entries(obj)) {
    if (keyLooksLikeNameField(key) && typeof val === 'string' && isLikelyPersonName(val)) {
      return val.trim();
    }
  }

  for (const val of Object.values(obj)) {
    const found = walkForCustomerName(val, depth + 1);
    if (found) return found;
  }

  return null;
}

export function extractBillCustomerName(
  data: Record<string, unknown> | null | undefined,
  apiMessage?: string | null
): string | null {
  if (data && typeof data === 'object') {
    if (typeof data.validation === 'string' && isLikelyPersonName(data.validation)) {
      return data.validation.trim();
    }
    const fromWalk = walkForCustomerName(data);
    if (fromWalk) return fromWalk;
  }
  return extractNameFromApiMessage(apiMessage);
}

export function parseBillValidationSummary(
  data: Record<string, unknown> | null | undefined,
  apiMessage?: string | null
): { customerName: string | null; amountMwk: number | null } {
  return {
    customerName: extractBillCustomerName(data, apiMessage),
    amountMwk: extractBillAmountMwk(data),
  };
}



export function extractBillAmountMwk(data: Record<string, unknown> | null | undefined): number | null {

  if (!data || typeof data !== 'object') return null;

  const keys = ['amount', 'balance', 'outstanding', 'bill_amount', 'billAmount', 'due_amount', 'dueAmount'];

  for (const key of keys) {

    const n = Number(data[key]);

    if (Number.isFinite(n) && n > 0) return Math.round(n);

  }

  for (const nestedKey of ['data', 'result', 'details']) {

    const nested = data[nestedKey];

    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {

      const found = extractBillAmountMwk(nested as Record<string, unknown>);

      if (found) return found;

    }

  }

  return null;

}



const TOKEN_KEY_HINTS = [

  'token',

  'vend',

  'meter',

  'prepaid',

  'electricity',

  'recharge',

  'sts',

  'pin',

  'voucher',

];



const IGNORE_TOKEN_KEYS = new Set([

  'reference',

  'transaction_id',

  'transactionid',

  'trans_id',

  'transid',

  'charge_id',

  'chargeid',

  'order_id',

  'orderid',

  'id',

  'uuid',

  'account',

  'biller',

  'status',

  'message',

  'amount',

  'currency',

]);



function looksLikeElectricityToken(value: string, merchantReference?: string): boolean {

  const v = value.trim();

  if (!v || v.length < 10) return false;

  if (merchantReference && v === merchantReference) return false;

  if (isMerchantBillReference(v)) return false;



  const digitsOnly = v.replace(/\s+/g, '');

  if (/^\d{16,24}$/.test(digitsOnly)) return true;

  if (/^\d{4}(\s\d{4}){3,5}$/.test(v)) return true;

  if (v.length >= 15 && /[0-9]/.test(v) && /[A-Za-z0-9+\-/]/.test(v) && !v.includes('@')) return true;

  return false;

}



function walkForToken(

  node: unknown,

  merchantReference: string | undefined,

  depth = 0

): string | null {

  if (depth > 8 || node == null) return null;



  if (typeof node === 'string') {

    return looksLikeElectricityToken(node, merchantReference) ? node.trim() : null;

  }



  if (Array.isArray(node)) {

    for (const item of node) {

      const found = walkForToken(item, merchantReference, depth + 1);

      if (found) return found;

    }

    return null;

  }



  if (typeof node !== 'object') return null;



  const obj = node as Record<string, unknown>;



  for (const [key, val] of Object.entries(obj)) {

    const keyLower = key.toLowerCase();

    if (IGNORE_TOKEN_KEYS.has(keyLower)) continue;



    if (typeof val === 'string') {

      const isTokenKey = TOKEN_KEY_HINTS.some((hint) => keyLower.includes(hint));

      if (isTokenKey && looksLikeElectricityToken(val, merchantReference)) {

        return val.trim();

      }

    }

  }



  for (const [key, val] of Object.entries(obj)) {

    const keyLower = key.toLowerCase();

    if (IGNORE_TOKEN_KEYS.has(keyLower)) continue;

    const found = walkForToken(val, merchantReference, depth + 1);

    if (found) return found;

  }



  return null;

}



/** Extract real utility token from PayChangu bill pay / transaction payload. */

export function extractUtilityBillToken(

  data: Record<string, unknown>,

  merchantReference?: string

): string | null {

  const fromWalk = walkForToken(data, merchantReference);

  if (fromWalk) return fromWalk;



  const candidates = [

    data.token,

    data.Token,

    data.meter_token,

    data.meterToken,

    data.vend_token,

    data.vendToken,

    data.receipt_token,

    data.receiptToken,

    data.prepaid_token,

    data.prepaidToken,

    data.electricity_token,

    data.electricityToken,

    data.sts_token,

    data.stsToken,

    data.pin,

    data.PIN,

    data.voucher,

    data.Voucher,

  ];

  for (const c of candidates) {

    if (c != null) {

      const s = String(c).trim();

      if (looksLikeElectricityToken(s, merchantReference)) return s;

    }

  }



  return null;

}



const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));



/** Pay response often omits token — fetch getTransactions by reference (with retries). */

export async function resolveUtilityBillTokenAfterPay(

  payData: Record<string, unknown>,

  reference: string

): Promise<string | null> {

  const fromPay = extractUtilityBillToken(payData, reference);

  if (fromPay) return fromPay;



  for (let attempt = 0; attempt < 5; attempt++) {

    if (attempt > 0) await sleep(2000);

    const tx = await paychanguGetBillTransaction(reference);

    if (!tx.ok || !tx.data) continue;

    const token = extractUtilityBillToken(tx.data, reference);

    if (token) return token;

  }

  return null;

}


