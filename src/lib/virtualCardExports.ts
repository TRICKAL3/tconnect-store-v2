import { virtualCardTxnStatusLabel } from './virtualCardStatus';

export type ExportableCard = {
  id: string;
  label: string;
  cardLast4: string | null;
  balanceUsd: number;
  orderNumber: string | null;
  orderDate: string | null;
  transactions: Array<{
    type: string;
    amountUsd: number;
    feeUsd?: number;
    totalUsd?: number;
    merchant: string | null;
    status: string;
    occurredAt: string;
  }>;
};

function formatExportDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadVirtualCardTransactionsCsv(
  card: ExportableCard,
  holderName: string
): void {
  const lines: string[] = [
    'TConnect Store — Virtual Card Transactions',
    `Card,${csvEscape(card.label)}`,
    `Cardholder,${csvEscape(holderName)}`,
    `Order #,${csvEscape(card.orderNumber || '—')}`,
    `Balance (USD),${card.balanceUsd.toFixed(2)}`,
    `Exported,${formatExportDate(new Date().toISOString())}`,
    '',
    'Date,Merchant,Amount (USD),Fee (USD),Total (USD),Status',
  ];

  for (const t of card.transactions) {
    const fee = t.feeUsd ?? 0;
    const amt = Math.abs(t.amountUsd);
    const total = t.totalUsd ?? amt + fee;
    lines.push(
      [
        csvEscape(formatExportDate(t.occurredAt)),
        csvEscape(t.merchant || '—'),
        amt.toFixed(2),
        fee.toFixed(2),
        total.toFixed(2),
        csvEscape(t.status || 'completed'),
      ].join(',')
    );
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tconnect-card-${card.orderNumber || card.id.slice(0, 8)}-transactions.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadVirtualCardTransactionsPdf(
  card: ExportableCard,
  holderName: string
): void {
  const rows = card.transactions
    .map((t) => {
      const fee = t.feeUsd ?? 0;
      const amt = Math.abs(t.amountUsd);
      const total = t.totalUsd ?? amt + fee;
      return `
      <tr>
        <td>${formatExportDate(t.occurredAt)}</td>
        <td>${(t.merchant || '—').replace(/</g, '&lt;')}</td>
        <td style="text-align:right">$${amt.toFixed(2)}</td>
        <td style="text-align:right">$${fee.toFixed(2)}</td>
        <td style="text-align:right;font-weight:600">$${total.toFixed(2)}</td>
        <td>${virtualCardTxnStatusLabel(t.status || 'completed').replace(/</g, '&lt;')}</td>
      </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Card Transactions — ${card.label}</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 32px; color: #111; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    .meta { font-size: 13px; color: #555; margin-bottom: 24px; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; }
    th { background: #f3f4f6; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <h1>${card.label.replace(/</g, '&lt;')}</h1>
  <div class="meta">
    <div>Cardholder: ${holderName.replace(/</g, '&lt;')}</div>
    <div>Order #: ${card.orderNumber || '—'}</div>
    <div>Balance: $${card.balanceUsd.toFixed(2)} USD</div>
    <div>Exported: ${formatExportDate(new Date().toISOString())}</div>
  </div>
  <table>
    <thead>
      <tr><th>Date</th><th>Merchant</th><th>Amount</th><th>Fee</th><th>Total</th><th>Status</th></tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="6" style="text-align:center;color:#888">No transactions</td></tr>'}
    </tbody>
  </table>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow pop-ups to download PDF (print to PDF).');
    return;
  }
  win.document.write(html);
  win.document.close();
}
