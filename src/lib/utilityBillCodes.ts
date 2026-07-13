export type UtilityBillCode = {
  token?: string;
  receipt?: string;
  biller?: string;
  account?: string;
  customerName?: string;
  amountMwk?: number;
  reference?: string;
  paidAt?: string;
};

function isMerchantBillReference(value: string | null | undefined): boolean {
  const v = String(value || '').trim();
  return /^TC-[a-f0-9-]+$/i.test(v);
}

export function parseUtilityBillCodes(raw: unknown): UtilityBillCode[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed) return [];
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.filter((e) => {
      const token = e?.token || e?.receipt;
      return token && !isMerchantBillReference(String(token));
    });
  } catch {
    return [];
  }
}
