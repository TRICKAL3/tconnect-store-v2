type InventorySnapshotExport = {
  balanceUsd: number;
  avgBuyRateMwk: number;
  totalCostBasisMwk: number;
  totalInUsd: number;
  totalOutUsd: number;
  realizedProfitLossMwk: number;
};

export type UsdtLedgerExportRow = {
  createdAt: string;
  direction: string;
  quantityUsd: number;
  buyRateMwk: number | null;
  sellRateMwk: number | null;
  costBasisMwk: number | null;
  revenueMwk: number | null;
  profitLossMwk: number | null;
  balanceAfterUsd: number | null;
  purpose: string | null;
  reference: string | null;
  notes: string | null;
};

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cell(value: string | number | null | undefined, type: 'String' | 'Number' = 'String'): string {
  if (value == null || value === '') return '<Cell><Data ss:Type="String"></Data></Cell>';
  if (type === 'Number' && typeof value === 'number' && Number.isFinite(value)) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  return `<Cell><Data ss:Type="String">${escXml(String(value))}</Data></Cell>`;
}

function row(cells: string): string {
  return `<Row>${cells}</Row>`;
}

/** Download USDT ledger as Excel (.xls XML spreadsheet — opens in Excel). */
export function downloadUsdtInventoryExcel(
  summary: InventorySnapshotExport | null,
  entries: UsdtLedgerExportRow[]
): void {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const headerRow = row(
    [
      'Date',
      'Type',
      'USDT Amount',
      'Buy Rate (MWK/$)',
      'Sell Rate (MWK/$)',
      'Cost (MWK)',
      'Revenue (MWK)',
      'Profit/Loss (MWK)',
      'Balance After (USDT)',
      'Purpose',
      'Reference',
      'Notes',
    ]
      .map((h) => cell(h))
      .join('')
  );

  const dataRows = sorted
    .map((e) =>
      row(
        [
          cell(new Date(e.createdAt).toLocaleString()),
          cell(e.direction === 'in' ? 'IN' : 'OUT'),
          cell(e.quantityUsd, 'Number'),
          cell(e.buyRateMwk ?? '', e.buyRateMwk != null ? 'Number' : 'String'),
          cell(e.sellRateMwk ?? '', e.sellRateMwk != null ? 'Number' : 'String'),
          cell(e.costBasisMwk ?? '', e.costBasisMwk != null ? 'Number' : 'String'),
          cell(e.revenueMwk ?? '', e.revenueMwk != null ? 'Number' : 'String'),
          cell(e.profitLossMwk ?? '', e.profitLossMwk != null ? 'Number' : 'String'),
          cell(e.balanceAfterUsd ?? '', e.balanceAfterUsd != null ? 'Number' : 'String'),
          cell(e.purpose || ''),
          cell(e.reference || ''),
          cell(e.notes || ''),
        ].join('')
      )
    )
    .join('');

  const summaryRows = summary
    ? [
        row(cell('USDT INVENTORY SUMMARY') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('')),
        row(cell('Balance (USDT)') + cell(summary.balanceUsd, 'Number') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('')),
        row(cell('Avg Buy Rate (MWK/$)') + cell(summary.avgBuyRateMwk, 'Number') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('')),
        row(cell('Stock Value Cost (MWK)') + cell(summary.totalCostBasisMwk, 'Number') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('')),
        row(cell('Total Added (USDT)') + cell(summary.totalInUsd, 'Number') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('')),
        row(cell('Total Used (USDT)') + cell(summary.totalOutUsd, 'Number') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('')),
        row(cell('Realized P/L (MWK)') + cell(summary.realizedProfitLossMwk, 'Number') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('')),
        row(cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('') + cell('')),
      ].join('')
    : '';

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="USDT Inventory">
<Table>
${summaryRows}
${headerRow}
${dataRows}
</Table>
</Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const date = new Date().toISOString().slice(0, 10);
  link.download = `tconnect-usdt-inventory-${date}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
