export type MwkSnapshotExport = {
  balanceMwk: number;
  totalInMwk: number;
  totalOutMwk: number;
  netFlowMwk: number;
  outByCategory: { purpose: string; label: string; totalMwk: number }[];
};

export type MwkLedgerExportRow = {
  createdAt: string;
  direction: string;
  quantityMwk: number | null;
  purpose: string | null;
  reference: string | null;
  notes: string | null;
  balanceAfterMwk: number | null;
  purposeLabel?: string;
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

export function downloadMwkInventoryExcel(
  summary: MwkSnapshotExport | null,
  entries: MwkLedgerExportRow[]
): void {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const pad = (first: string, second?: string) =>
    first + (second ? cell(second) : cell('')) + cell('') + cell('') + cell('') + cell('') + cell('');

  const summaryRows = summary
    ? [
        row(pad('MWK TRACKING SUMMARY')),
        row(pad('Balance (MWK)', String(summary.balanceMwk))),
        row(pad('Total MWK In', String(summary.totalInMwk))),
        row(pad('Total MWK Out', String(summary.totalOutMwk))),
        row(pad('Net Flow (MWK)', String(summary.netFlowMwk))),
        ...summary.outByCategory.map((c) =>
          row(pad(`Expense: ${c.label}`, String(c.totalMwk)))
        ),
        row(pad('')),
      ].join('')
    : '';

  const headerRow = row(
    ['Date', 'Type', 'Amount (MWK)', 'Category', 'Balance After (MWK)', 'Reference', 'Notes']
      .map((h) => cell(h))
      .join('')
  );

  const dataRows = sorted
    .map((e) =>
      row(
        [
          cell(new Date(e.createdAt).toLocaleString()),
          cell(e.direction === 'in' ? 'IN' : 'OUT'),
          cell(e.quantityMwk ?? '', e.quantityMwk != null ? 'Number' : 'String'),
          cell(e.purposeLabel || e.purpose || ''),
          cell(e.balanceAfterMwk ?? '', e.balanceAfterMwk != null ? 'Number' : 'String'),
          cell(e.reference || ''),
          cell(e.notes || ''),
        ].join('')
      )
    )
    .join('');

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="MWK Tracking">
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
  link.download = `tconnect-mwk-tracking-${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
