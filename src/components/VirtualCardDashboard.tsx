import React from 'react';

import VirtualCardTxnTable from './VirtualCardTxnTable';
import { buildTxnDedupeKey } from '../lib/parseSwypeTransactions';

import {

  virtualCardStatusClass,

  virtualCardStatusLabel,

} from '../lib/virtualCardStatus';

import VirtualCardVisual from './VirtualCardVisual';

import type { UserCard } from './MyCardsSection';



type Props = {

  card: UserCard;

  holderName: string;

};



function MetricTile({

  label,

  value,

  hint,

  accent,

}: {

  label: string;

  value: string;

  hint?: string;

  accent?: string;

}) {

  return (

    <div className="rounded-xl border border-dark-border bg-dark-surface/70 p-4 flex flex-col justify-between min-h-[84px]">

      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-gray-500">

        <span>{label}</span>

      </div>

      <p className={`text-xl sm:text-2xl font-bold tracking-tight mt-2 ${accent ?? 'text-white'}`}>{value}</p>

      {hint && <p className="text-[10px] text-gray-600 mt-1">{hint}</p>}

    </div>

  );

}



const VirtualCardDashboard: React.FC<Props> = ({ card, holderName }) => {

  return (

    <div className="space-y-6">

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_1fr] gap-6 items-start">

        <VirtualCardVisual

          label={card.label}

          cardLast4={card.cardLast4}

          status={card.status}

          holderName={holderName}

          imageUrl={card.imageUrl}

          cardDetails={card.cardDetails}

          className="mx-auto lg:mx-0 w-full"

        />



        <div className="space-y-3">

          <div className="rounded-xl border border-dark-border bg-dark-surface/40 px-4 py-3">

            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">

              <h3 className="text-base font-bold text-white">{card.label}</h3>

              <span

                className={`text-xs px-3 py-1 rounded-full border font-semibold ${virtualCardStatusClass(card.status)}`}

              >

                {virtualCardStatusLabel(card.status)}

              </span>

            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">

              <div className="rounded-lg bg-dark-bg/60 px-3 py-2">

                <p className="text-gray-500">Card type</p>

                <p className="text-white font-medium mt-0.5">TConnect Cards</p>

              </div>

              <div className="rounded-lg bg-dark-bg/60 px-3 py-2">

                <p className="text-gray-500">Last 4 digits</p>

                <p className="text-white font-mono font-medium mt-0.5">

                  {card.cardLast4 ? `•••• ${card.cardLast4}` : '—'}

                </p>

              </div>

            </div>

          </div>



          <div className="grid grid-cols-2 gap-3">

            <MetricTile

              label="Available Balance"

              value={`$${card.balanceUsd.toFixed(2)}`}

              hint="Remaining funds on this prepaid card"

              accent="text-cyan-300"

            />

            <MetricTile

              label="Card Value"

              value={`$${(card.cardValueUsd ?? 0).toFixed(2)}`}

              hint="Original loaded value"

            />

            <MetricTile label="Total Fees" value={`$${(card.totalFeesUsd ?? 0).toFixed(2)}`} />

            <MetricTile label="Total Spendings" value={`$${(card.totalSpendingsUsd ?? 0).toFixed(2)}`} />

          </div>



          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-xs text-gray-400 leading-relaxed">

            <p className="font-semibold text-cyan-200/90 mb-1">Prepaid card — not reloadable</p>

            <p>

              TConnect Cards are prepaid. When the balance is used up, this card cannot be topped up. Purchase a new

              card to continue spending.

            </p>

          </div>

        </div>

      </div>



      <div className="rounded-2xl border border-dark-border bg-dark-surface/40 overflow-hidden">

        <div className="px-4 py-3 border-b border-dark-border flex items-center justify-between">

          <h4 className="text-sm font-semibold text-white">Transactions</h4>

          <span className="text-[11px] text-gray-500">{card.transactions.length} total</span>

        </div>

        {card.transactions.length === 0 ? (

          <p className="text-sm text-gray-500 px-4 py-10 text-center">No transactions yet.</p>

        ) : (

          <VirtualCardTxnTable

            rows={card.transactions.map((t) => ({

              id: t.id,

              swypeTxnId: t.swypeTxnId,

              merchant: t.merchant,

              occurredAt: t.occurredAt,

              amountUsd: t.amountUsd,

              feeUsd: t.feeUsd,

              totalUsd: t.totalUsd,

              status: t.status,

            }))}

            getRowKey={(t) => t.id || t.swypeTxnId || buildTxnDedupeKey(t)}

          />

        )}

      </div>

    </div>

  );

};



export default VirtualCardDashboard;


