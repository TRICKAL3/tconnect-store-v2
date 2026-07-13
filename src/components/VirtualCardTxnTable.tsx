import React from 'react';
import { virtualCardTxnStatusClass, virtualCardTxnStatusLabel } from '../lib/virtualCardStatus';

export type VirtualCardTxnRow = {
  id?: string;
  swypeTxnId?: string | null;
  merchant: string | null;
  occurredAt: string;
  amountUsd: number;
  feeUsd?: number;
  totalUsd?: number;
  status?: string | null;
};

function formatTxnDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function txnAmounts(t: VirtualCardTxnRow) {
  const fee = t.feeUsd ?? 0;
  const amt = Math.abs(t.amountUsd);
  const total = t.totalUsd ?? amt + fee;
  return { fee, amt, total };
}

type Props = {
  rows: VirtualCardTxnRow[];
  compact?: boolean;
  maxHeight?: string;
  duplicateKeys?: Set<string>;
  getRowKey?: (row: VirtualCardTxnRow, index: number) => string;
  getDuplicateKey?: (row: VirtualCardTxnRow) => string | null;
};

const VirtualCardTxnTable: React.FC<Props> = ({
  rows,
  compact = false,
  maxHeight,
  duplicateKeys,
  getRowKey,
  getDuplicateKey,
}) => {
  const cell = compact ? 'px-3 py-1.5' : 'px-4 py-3';
  const head = compact ? 'px-3 py-2' : 'px-4 py-2.5';

  return (
    <div
      className={`overflow-x-auto ${compact ? '' : 'rounded-lg border border-dark-border'} ${maxHeight ? `${maxHeight} overflow-y-auto` : ''}`}
    >
      <table className={`w-full text-xs ${compact ? '' : 'text-sm'} min-w-[640px]`}>
        <thead className={maxHeight ? 'sticky top-0 bg-dark-bg/95 z-10' : 'bg-dark-bg/40'}>
          <tr className="text-gray-500 text-left border-b border-dark-border">
            <th className={`${head} font-medium`}>Merchant</th>
            <th className={`${head} font-medium`}>Date &amp; time</th>
            <th className={`${head} font-medium text-right`}>Amount</th>
            <th className={`${head} font-medium text-right`}>Fee</th>
            <th className={`${head} font-medium text-right`}>Total</th>
            <th className={`${head} font-medium`}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => {
            const { fee, amt, total } = txnAmounts(t);
            const dupKey = getDuplicateKey?.(t);
            const isDup = dupKey ? duplicateKeys?.has(dupKey) : false;
            return (
              <tr
                key={getRowKey?.(t, i) ?? t.id ?? t.swypeTxnId ?? i}
                className={`border-t border-dark-border/60 ${isDup ? 'opacity-60' : ''} ${compact ? '' : 'hover:bg-dark-surface/50'}`}
              >
                <td className={`${cell} ${compact ? '' : 'text-neon-blue'}`}>
                  {t.merchant || '—'}
                  {isDup && <span className="ml-1 text-amber-400">(exists)</span>}
                </td>
                <td className={`${cell} text-gray-400 whitespace-nowrap`}>{formatTxnDate(t.occurredAt)}</td>
                <td className={`${cell} text-right text-white`}>${amt.toFixed(2)}</td>
                <td className={`${cell} text-right text-gray-400`}>${fee.toFixed(2)}</td>
                <td className={`${cell} text-right font-semibold text-white`}>${total.toFixed(2)}</td>
                <td className={cell}>
                  <span
                    className={`inline-block text-[10px] px-2 py-0.5 rounded-full border font-medium ${virtualCardTxnStatusClass(t.status || 'completed')}`}
                  >
                    {virtualCardTxnStatusLabel(t.status || 'completed')}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default VirtualCardTxnTable;
