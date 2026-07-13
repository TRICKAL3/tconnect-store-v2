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
