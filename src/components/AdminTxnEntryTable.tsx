import React from 'react';
import { ClipboardPaste, Plus, Trash2 } from 'lucide-react';
import {
  EMPTY_MANUAL_TXN_ROW,
  buildTxnDedupeKey,
  manualRowsFromPaste,
  parseManualTxnRow,
  parseManualTxnRows,
  rowHasManualTxnInput,
  type ManualTxnRow,
  type ParsedSwypeTxn,
} from '../lib/parseSwypeTransactions';

type Props = {
  rows: ManualTxnRow[];
  onChange: (rows: ManualTxnRow[]) => void;
  existingTxnKeys: Set<string>;
};

const inputClass =
  'w-full min-w-0 px-2 py-1.5 rounded-md bg-dark-surface border border-dark-border text-xs focus:border-neon-blue/40 outline-none';

const AdminTxnEntryTable: React.FC<Props> = ({ rows, onChange, existingTxnKeys }) => {
  const parsed = parseManualTxnRows(rows);
  const parsedByIndex = rows.map((row) => (rowHasManualTxnInput(row) ? parseManualTxnRow(row) : null));

  const updateRow = (index: number, patch: Partial<ManualTxnRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => onChange([...rows, { ...EMPTY_MANUAL_TXN_ROW }]);

  const removeRow = (index: number) => {
    if (rows.length <= 1) {
      onChange([{ ...EMPTY_MANUAL_TXN_ROW }]);
      return;
    }
    onChange(rows.filter((_, i) => i !== index));
  };

  const clearAll = () => onChange([{ ...EMPTY_MANUAL_TXN_ROW }]);

  const importClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text?.trim()) return;
      const imported = manualRowsFromPaste(text);
      if (imported.length === 0) {
        alert('Nothing parsed — check merchant, date, amount, fee, total, status.');
        return;
      }
      const kept = rows.filter(
        (r) => r.merchant.trim() || r.occurredAt.trim() || r.amountUsd.trim()
      );
      onChange([...kept, ...imported]);
    } catch {
      alert('Could not read clipboard.');
    }
  };

  const newCount = parsed.filter((t) => !existingTxnKeys.has(buildTxnDedupeKey(t))).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-gray-500">
          Fill one row per transaction. Same columns the customer will see.
          {parsed.length > 0 && (
            <span className="ml-2 text-green-400 font-semibold">
              {parsed.length} ready · {newCount} new
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neon-blue/40 bg-neon-blue/10 text-xs font-medium text-neon-blue hover:bg-neon-blue/20"
          >
            <Plus className="w-3.5 h-3.5" />
            Add row
          </button>
          <button
            type="button"
            onClick={importClipboard}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dark-border text-xs text-gray-400 hover:text-white hover:border-dark-border/80"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            Import clipboard
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-red-400"
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-dark-border">
        <table className="w-full text-xs min-w-[760px]">
          <thead className="bg-dark-bg/60">
            <tr className="text-gray-500 text-left border-b border-dark-border">
              <th className="px-2 py-2 font-medium min-w-[120px]">Merchant</th>
              <th className="px-2 py-2 font-medium min-w-[180px]">Date &amp; time</th>
              <th className="px-2 py-2 font-medium w-24">Amount</th>
              <th className="px-2 py-2 font-medium w-20">Fee</th>
              <th className="px-2 py-2 font-medium w-24">Total</th>
              <th className="px-2 py-2 font-medium w-28">Status</th>
              <th className="px-2 py-2 w-10" aria-label="Remove row" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const parsedRow: ParsedSwypeTxn | null = parsedByIndex[index];
              const invalid =
                (row.merchant.trim() || row.occurredAt.trim() || row.amountUsd.trim()) && !parsedRow;
              const isDup = parsedRow ? existingTxnKeys.has(buildTxnDedupeKey(parsedRow)) : false;
              return (
                <tr
                  key={index}
                  className={`border-t border-dark-border/60 ${invalid ? 'bg-amber-500/5' : ''} ${isDup ? 'opacity-60' : ''}`}
                >
                  <td className="px-2 py-1.5">
                    <input
                      value={row.merchant}
                      onChange={(e) => updateRow(index, { merchant: e.target.value })}
                      placeholder="NAMECHEAP"
                      className={inputClass}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="datetime-local"
                      value={row.occurredAt}
                      onChange={(e) => updateRow(index, { occurredAt: e.target.value })}
                      className={inputClass}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      value={row.amountUsd}
                      onChange={(e) => updateRow(index, { amountUsd: e.target.value })}
                      placeholder="$11.18"
                      className={inputClass}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      value={row.feeUsd}
                      onChange={(e) => updateRow(index, { feeUsd: e.target.value })}
                      placeholder="$0.15"
                      className={inputClass}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      value={row.totalUsd}
                      onChange={(e) => updateRow(index, { totalUsd: e.target.value })}
                      placeholder="$11.33"
                      className={inputClass}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      value={row.status}
                      onChange={(e) => updateRow(index, { status: e.target.value })}
                      className={inputClass}
                    >
                      <option value="POSTED">Posted</option>
                      <option value="DECLINED">Declined</option>
                      <option value="PENDING">Pending</option>
                    </select>
                    {isDup && <p className="text-[10px] text-amber-400 mt-0.5">Already on card</p>}
                    {invalid && <p className="text-[10px] text-amber-400 mt-0.5">Check date/amounts</p>}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                      title="Remove row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminTxnEntryTable;
