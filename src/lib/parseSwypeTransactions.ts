/** Parse transaction rows copied from the card provider dashboard (tab-separated). */

export type ParsedSwypeTxn = {
  swypeTxnId: string;
  occurredAt: string;
  merchant: string;
  amountUsd: number;
  feeUsd: number;
  totalUsd: number;
  type: string;
  status: string;
  swypeStatus: string;
  location: string;
  cardLast4: string;
};

function parseMoney(raw: string): number {
  return Number(String(raw || '').replace(/[$,\s]/g, '')) || 0;
}

function mapSwypeStatus(raw: string): string {
  const u = String(raw || '').trim().toUpperCase();
  if (['POSTED', 'APPROVED', 'COMPLETED', 'SUCCESS', 'PASS', 'CLEARED'].includes(u)) return 'completed';
  if (['DECLINED', 'FAILED', 'REJECTED', 'DENIED'].includes(u)) return 'declined';
  if (['PENDING', 'PROCESSING', 'AUTHORIZED'].includes(u)) return 'pending';
  return 'completed';
}

function mapTxnType(raw: string): string {
  const u = String(raw || '').trim().toLowerCase();
  if (u.includes('refund')) return 'refund';
  if (u.includes('fee')) return 'fee';
  if (u.includes('top')) return 'topup';
  if (u.includes('adjust')) return 'adjustment';
  return 'purchase';
}

function parseSwypeDate(raw: string): Date | null {
  const d = new Date(String(raw || '').trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

function syntheticTxnId(merchant: string, occurredAt: string, amountUsd: number, totalUsd: number): string {
  const key = `${merchant.trim().toLowerCase()}|${occurredAt}|${amountUsd}|${totalUsd}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  return `txn-${Math.abs(h)}`;
}

/** Stable key for matching duplicates in admin UI and merges. */
export function buildTxnDedupeKey(txn: {
  swypeTxnId?: string | null;
  merchant?: string | null;
  occurredAt?: string;
  amountUsd?: number;
  totalUsd?: number;
}): string {
  if (txn.swypeTxnId) return txn.swypeTxnId;
  const fee = 0;
  const amt = Math.abs(txn.amountUsd ?? 0);
  const total = txn.totalUsd ?? amt + fee;
  return syntheticTxnId(txn.merchant || '', txn.occurredAt || '', amt, total);
}

function isHeaderLine(line: string): boolean {
  const u = line.toUpperCase();
  if (u.startsWith('ID') && u.includes('DATE') && u.includes('MERCHANT')) return true;
  if (u.startsWith('MERCHANT') && u.includes('DATE')) return true;
  return false;
}

function splitSimpleLine(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  if (trimmed.includes('\t')) {
    const cols = trimmed.split('\t').map((c) => c.trim());
    if (cols.length >= 6 && parseSwypeDate(cols[1]) && !/^\d{5,}$/.test(cols[0])) {
      return cols.slice(0, 6);
    }
  }

  const match = trimmed.match(
    /^(.+?)\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4},\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M)\s+(\$[\d,.]+)\s+(\$[\d,.]+)\s+(\$[\d,.]+)\s+(\S+)\s*$/i
  );
  if (match) return match.slice(1);

  return null;
}

function simpleColsToTxn(cols: string[]): ParsedSwypeTxn | null {
  const [merchant, dateStr, amount, fee, total, statusRaw] = cols;
  const occurred = parseSwypeDate(dateStr);
  if (!occurred || !merchant?.trim()) return null;

  const amt = parseMoney(amount);
  const feeAmt = parseMoney(fee);
  const totalAmt = parseMoney(total) || amt + feeAmt;
  const swypeStatus = (statusRaw || 'POSTED').trim().toUpperCase();
  const occurredIso = occurred.toISOString();

  return {
    swypeTxnId: syntheticTxnId(merchant, occurredIso, amt, totalAmt),
    occurredAt: occurredIso,
    merchant: merchant.trim(),
    amountUsd: amt,
    feeUsd: feeAmt,
    totalUsd: totalAmt,
    type: 'purchase',
    status: mapSwypeStatus(swypeStatus),
    swypeStatus,
    location: '',
    cardLast4: '',
  };
}

/** Split one pasted row into columns (tab-first, then spaced date pattern). */
function splitDataLine(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  if (trimmed.includes('\t')) {
    const cols = trimmed.split('\t').map((c) => c.trim());
    if (cols.length >= 7 && /^\d+$/.test(cols[0])) return cols;
  }

  const datePattern =
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4},\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M)/i;
  const dateMatch = trimmed.match(datePattern);
  if (dateMatch && dateMatch.index != null) {
    const id = trimmed.slice(0, dateMatch.index).trim();
    const afterDate = trimmed.slice(dateMatch.index + dateMatch[1].length).trim();
    const moneyParts = afterDate.match(/(\$[\d,.]+)/g);
    if (id && moneyParts && moneyParts.length >= 2) {
      const firstMoney = afterDate.indexOf(moneyParts[0]);
      const merchant = afterDate.slice(0, firstMoney).trim();
      const rest = afterDate.slice(firstMoney).trim().split(/\s+/);
      const amounts = moneyParts.map(parseMoney);
      const tail = rest.filter((p) => !p.startsWith('$'));
      return [
        id,
        dateMatch[1],
        merchant,
        String(amounts[0] ?? 0),
        String(amounts[1] ?? 0),
        String(amounts[2] ?? amounts[0] + amounts[1]),
        tail[0] || 'PURCHASE',
        tail[1] || 'POSTED',
        tail[2] || '',
        tail[3] || '',
      ];
    }
  }

  const match = trimmed.match(
    /^(\S+)\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4},\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M)\s+(\S+)\s+(\$[\d,.]+)\s+(\$[\d,.]+)\s+(\$[\d,.]+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/i
  );
  if (match) return match.slice(1);

  return null;
}

function rowToTxn(cols: string[]): ParsedSwypeTxn | null {
  if (cols.length < 7) return null;

  const id = cols[0];
  const dateStr = cols[1];
  const merchant = cols[2];
  const amount = cols[3];
  const fee = cols[4];
  const total = cols[5];
  const txnType = cols[6] || 'PURCHASE';
  const swypeStatus = cols[7] || 'POSTED';
  const location = cols[8] || '';
  const card = cols[9] || '';

  const occurred = parseSwypeDate(dateStr);
  if (!occurred || !id) return null;

  const amt = parseMoney(amount);
  const feeAmt = parseMoney(fee);
  const totalAmt = parseMoney(total) || amt + feeAmt;

  return {
    swypeTxnId: id,
    occurredAt: occurred.toISOString(),
    merchant,
    amountUsd: amt,
    feeUsd: feeAmt,
    totalUsd: totalAmt,
    type: mapTxnType(txnType),
    status: mapSwypeStatus(swypeStatus),
    swypeStatus: swypeStatus.toUpperCase(),
    location,
    cardLast4: card.replace(/\D/g, '').slice(-4) || card,
  };
}

function lineToTxn(line: string): ParsedSwypeTxn | null {
  const simpleCols = splitSimpleLine(line);
  if (simpleCols) {
    const simple = simpleColsToTxn(simpleCols);
    if (simple) return simple;
  }

  const cols = splitDataLine(line);
  if (!cols) return null;
  return rowToTxn(cols);
}

/** Parse many transaction rows from one paste (one row per line). */
export function parseSwypeTransactionPaste(text: string): ParsedSwypeTxn[] {
  const normalized = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const lines = normalized.split('\n').map((l) => l.trim()).filter(Boolean);
  const results: ParsedSwypeTxn[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (isHeaderLine(line)) continue;
    const txn = lineToTxn(line);
    if (!txn || seen.has(txn.swypeTxnId)) continue;
    seen.add(txn.swypeTxnId);
    results.push(txn);
  }

  return results.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );
}

export type ManualTxnRow = {
  merchant: string;
  occurredAt: string;
  amountUsd: string;
  feeUsd: string;
  totalUsd: string;
  status: string;
};

export const EMPTY_MANUAL_TXN_ROW: ManualTxnRow = {
  merchant: '',
  occurredAt: '',
  amountUsd: '',
  feeUsd: '',
  totalUsd: '',
  status: 'POSTED',
};

export function mergeParsedTransactions(
  prev: ParsedSwypeTxn[],
  next: ParsedSwypeTxn[]
): ParsedSwypeTxn[] {
  const m = new Map<string, ParsedSwypeTxn>();
  for (const t of prev) m.set(t.swypeTxnId, t);
  for (const t of next) m.set(t.swypeTxnId, t);
  return Array.from(m.values()).sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );
}

function formatManualDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}

/** @deprecated use parseManualTxnRow */
export function manualRowToLine(row: ManualTxnRow): string {
  return [
    row.merchant.trim(),
    row.occurredAt.trim(),
    row.amountUsd.trim(),
    row.feeUsd.trim(),
    row.totalUsd.trim(),
    row.status.trim() || 'POSTED',
  ].join('\t');
}

function rowHasInput(row: ManualTxnRow): boolean {
  return Boolean(
    row.merchant.trim() ||
      row.occurredAt.trim() ||
      row.amountUsd.trim() ||
      row.feeUsd.trim() ||
      row.totalUsd.trim()
  );
}

function parseManualDate(raw: string): Date | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return parseSwypeDate(trimmed);
}

/** Parse one admin table row directly (no tab-separated line). */
export function parseManualTxnRow(row: ManualTxnRow): ParsedSwypeTxn | null {
  if (!row.merchant?.trim()) return null;

  const occurred = parseManualDate(row.occurredAt);
  if (!occurred) return null;

  const amt = parseMoney(row.amountUsd);
  const feeAmt = parseMoney(row.feeUsd);
  const totalAmt = parseMoney(row.totalUsd) || amt + feeAmt;
  if (amt === 0 && totalAmt === 0) return null;

  const swypeStatus = (row.status || 'POSTED').trim().toUpperCase();
  const occurredIso = occurred.toISOString();

  return {
    swypeTxnId: syntheticTxnId(row.merchant, occurredIso, amt, totalAmt),
    occurredAt: occurredIso,
    merchant: row.merchant.trim(),
    amountUsd: amt,
    feeUsd: feeAmt,
    totalUsd: totalAmt,
    type: 'purchase',
    status: mapSwypeStatus(swypeStatus),
    swypeStatus,
    location: '',
    cardLast4: '',
  };
}

export function parseManualTxnRows(rows: ManualTxnRow[]): ParsedSwypeTxn[] {
  const results: ParsedSwypeTxn[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (!rowHasInput(row)) continue;
    const txn = parseManualTxnRow(row);
    if (!txn || seen.has(txn.swypeTxnId)) continue;
    seen.add(txn.swypeTxnId);
    results.push(txn);
  }

  return results.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );
}

export function rowHasManualTxnInput(row: ManualTxnRow): boolean {
  return rowHasInput(row);
}

export function parsedToManualRow(txn: ParsedSwypeTxn): ManualTxnRow {
  const d = new Date(txn.occurredAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const localDate = Number.isNaN(d.getTime())
    ? txn.occurredAt
    : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  return {
    merchant: txn.merchant,
    occurredAt: localDate,
    amountUsd: `$${txn.amountUsd.toFixed(2)}`,
    feeUsd: `$${txn.feeUsd.toFixed(2)}`,
    totalUsd: `$${txn.totalUsd.toFixed(2)}`,
    status: txn.swypeStatus || 'POSTED',
  };
}

export function manualRowsFromPaste(text: string): ManualTxnRow[] {
  return parseSwypeTransactionPaste(text).map(parsedToManualRow);
}
