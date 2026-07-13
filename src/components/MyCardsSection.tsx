import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { getApiBase } from '../lib/getApiBase';
import { readResponseJson } from '../lib/parseResponseJson';
import {
  virtualCardStatusClass,
  virtualCardStatusLabel,
} from '../lib/virtualCardStatus';
import {
  downloadVirtualCardTransactionsCsv,
  downloadVirtualCardTransactionsPdf,
} from '../lib/virtualCardExports';
import VirtualCardDashboard from './VirtualCardDashboard';

export type CardTxn = {
  id: string;
  type: string;
  amountUsd: number;
  feeUsd?: number;
  totalUsd?: number;
  merchant: string | null;
  status: string;
  occurredAt: string;
  swypeTxnId?: string | null;
  notes?: string | null;
};

export type CardDetails = {
  cardNumber: string;
  expireDate: string;
  cvv: string;
};

export type UserCard = {
  id: string;
  label: string;
  cardType?: string;
  cardLast4: string | null;
  balanceUsd: number;
  cardValueUsd?: number;
  totalFeesUsd?: number;
  totalSpendingsUsd?: number;
  initialBalanceUsd: number | null;
  status: string;
  userNotes: string | null;
  lastSyncedAt: string | null;
  updateRequestedAt: string | null;
  orderId: string | null;
  orderNumber: string | null;
  orderDate: string;
  createdAt: string;
  imageUrl: string | null;
  cardDetails?: CardDetails | null;
  transactions: CardTxn[];
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function isAwaitingUpdate(card: UserCard): boolean {
  if (!card.updateRequestedAt) return false;
  if (!card.lastSyncedAt) return true;
  return new Date(card.lastSyncedAt) < new Date(card.updateRequestedAt);
}

type Props = {
  userEmail: string;
  userName: string;
};

const POLL_MS = 5000;
const BACKGROUND_POLL_MS = 12000;
const MAX_POLL_MS = 10 * 60 * 1000;

const MyCardsSection: React.FC<Props> = ({ userEmail, userName }) => {
  const [cards, setCards] = useState<UserCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [requestingUpdate, setRequestingUpdate] = useState(false);
  const pollStartedRef = useRef<number | null>(null);

  const selectedCard = useMemo(
    () => cards.find((c) => c.id === selectedId) ?? null,
    [cards, selectedId]
  );

  const awaitingUpdate = selectedCard ? isAwaitingUpdate(selectedCard) : false;

  const loadCards = useCallback(async (quiet = false) => {
    if (!userEmail) {
      setCards([]);
      return;
    }
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBase()}/user-cards?email=${encodeURIComponent(userEmail)}`);
      const data = await readResponseJson(res);
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to load cards');
      const list = Array.isArray((data as { cards?: unknown }).cards)
        ? (data as { cards: UserCard[] }).cards
        : [];
      list.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
      setCards(list);
    } catch (e: unknown) {
      if (!quiet) {
        setError(e instanceof Error ? e.message : 'Failed to load cards');
        setCards([]);
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [userEmail]);

  const pollCard = useCallback(async () => {
    if (!selectedId || !userEmail) return;
    try {
      const res = await fetch(
        `${getApiBase()}/user-cards/${selectedId}?email=${encodeURIComponent(userEmail)}`
      );
      const data = await readResponseJson<{ card?: UserCard; awaitingUpdate?: boolean }>(res);
      if (!res.ok || !data.card) return;
      setCards((prev) => prev.map((c) => (c.id === data.card!.id ? data.card! : c)));
      if (!data.awaitingUpdate) {
        pollStartedRef.current = null;
      }
    } catch {
      /* ignore poll errors */
    }
  }, [selectedId, userEmail]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  useEffect(() => {
    if (!userEmail) return;
    const id = window.setInterval(() => loadCards(true), BACKGROUND_POLL_MS);
    return () => window.clearInterval(id);
  }, [userEmail, loadCards]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        loadCards(true);
        if (selectedId) pollCard();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadCards, pollCard, selectedId]);

  useEffect(() => {
    if (!selectedId || !userEmail) return;
    const id = window.setInterval(pollCard, BACKGROUND_POLL_MS);
    return () => window.clearInterval(id);
  }, [selectedId, userEmail, pollCard]);

  useEffect(() => {
    if (!awaitingUpdate || !selectedId) {
      pollStartedRef.current = null;
      return;
    }
    if (!pollStartedRef.current) pollStartedRef.current = Date.now();

    const id = window.setInterval(() => {
      if (pollStartedRef.current && Date.now() - pollStartedRef.current > MAX_POLL_MS) {
        pollStartedRef.current = null;
        return;
      }
      pollCard();
    }, POLL_MS);

    return () => window.clearInterval(id);
  }, [awaitingUpdate, selectedId, pollCard]);

  const requestCardUpdate = async () => {
    if (!selectedCard || !userEmail) return;
    setRequestingUpdate(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBase()}/user-cards/${selectedCard.id}/request-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });
      const data = await readResponseJson<{ card?: UserCard; error?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Could not request update');
      if (data.card) {
        setCards((prev) => prev.map((c) => (c.id === data.card!.id ? data.card! : c)));
      }
      pollStartedRef.current = Date.now();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setRequestingUpdate(false);
    }
  };

  const exportCard = selectedCard
    ? {
        id: selectedCard.id,
        label: selectedCard.label,
        cardLast4: selectedCard.cardLast4,
        balanceUsd: selectedCard.balanceUsd,
        orderNumber: selectedCard.orderNumber,
        orderDate: selectedCard.orderDate,
        transactions: selectedCard.transactions,
      }
    : null;

  if (loading && cards.length === 0) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm py-8 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading your cards…
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-dark-border bg-dark-surface/30 px-4 py-8 text-center">
        <CreditCard className="w-10 h-10 text-gray-600 mx-auto mb-3" />
        <p className="text-sm text-gray-400">No virtual cards yet.</p>
        <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
          After you order a virtual card, it will show up here automatically.
        </p>
        <Link to="/payments" className="inline-block mt-4 text-sm text-neon-blue hover:underline">
          Browse virtual cards
        </Link>
      </div>
    );
  }

  // —— List view ——
  if (!selectedCard) {
    return (
      <div className="space-y-4">
        {error && <p className="text-sm text-red-400">{error}</p>}
        <p className="text-xs text-gray-500">Tap a card to view details, balance, and transactions.</p>
        <ul className="space-y-3">
          {cards.map((card) => (
            <li key={card.id}>
              <button
                type="button"
                onClick={() => setSelectedId(card.id)}
                className="w-full text-left rounded-2xl border border-dark-border bg-dark-surface/50 hover:border-neon-blue/40 hover:bg-dark-surface/80 transition-all overflow-hidden group"
              >
                <div className="flex flex-col sm:flex-row">
                  <div className="relative sm:w-44 shrink-0 h-24 sm:h-auto bg-gradient-to-br from-[#0f172a] via-[#1e3a5f] to-[#312e81] border-b sm:border-b-0 sm:border-r border-dark-border">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(56,189,248,0.2),_transparent_60%)]" />
                    <div className="relative h-full flex flex-col justify-between p-4 text-white">
                      <div>
                        <p className="font-['Orbitron'] text-[8px] font-bold tracking-[0.22em] text-white leading-tight">
                          TCONNECT
                        </p>
                        <p className="font-['Orbitron'] text-[7px] font-semibold tracking-[0.32em] text-cyan-300/80">
                          CARDS
                        </p>
                      </div>
                      <p className="font-mono text-sm tracking-widest text-white/90">
                        •••• {card.cardLast4?.slice(-4) || '••••'}
                      </p>
                    </div>
                  </div>
                  <div className="flex-1 flex items-center gap-3 px-4 py-4 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-white truncate">{card.label}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border ${virtualCardStatusClass(card.status)}`}
                        >
                          {virtualCardStatusLabel(card.status)}
                        </span>
                        {isAwaitingUpdate(card) && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300">
                            Refresh pending
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        Order {card.orderNumber ? `#${card.orderNumber}` : '—'}
                        <span className="text-gray-600 mx-1">·</span>
                        {formatShortDate(card.orderDate)}
                      </p>
                      <p className="text-[11px] text-gray-600 mt-0.5">
                        Updated {formatDate(card.lastSyncedAt)}
                      </p>
                    </div>
                    <div className="text-right shrink-0 pr-1">
                      <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Balance</p>
                      <p className="text-xl font-bold text-cyan-300">${card.balanceUsd.toFixed(2)}</p>
                      <p className="text-[10px] text-neon-blue/80 mt-1 group-hover:underline">Manage →</p>
                    </div>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // —— Detail view ——
  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => setSelectedId(null)}
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-neon-blue transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        All cards ({cards.length})
      </button>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="relative">
        {(awaitingUpdate || requestingUpdate) && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-dark-bg/90 backdrop-blur-sm border border-neon-blue/20 px-6 py-12 text-center min-h-[280px]">
            <Loader2 className="w-10 h-10 text-neon-blue animate-spin mb-4" />
            <p className="text-base font-medium text-white">Updating your card…</p>
            <p className="text-xs text-gray-500 mt-2 max-w-xs">
              We are refreshing your TConnect virtual card details.
            </p>
            <p className="text-[11px] text-gray-600 mt-4 italic">This might take a moment</p>
          </div>
        )}

        <VirtualCardDashboard card={selectedCard} holderName={userName} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={requestCardUpdate}
          disabled={requestingUpdate || awaitingUpdate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg btn-cyber text-white text-sm font-semibold disabled:opacity-50"
        >
          {requestingUpdate || awaitingUpdate ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Refresh card
        </button>
        {exportCard && selectedCard.transactions.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => downloadVirtualCardTransactionsCsv(exportCard, userName)}
              className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dark-border bg-dark-surface text-sm text-gray-300 hover:border-neon-blue/40 hover:text-white"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel (CSV)
            </button>
            <button
              type="button"
              onClick={() => downloadVirtualCardTransactionsPdf(exportCard, userName)}
              className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dark-border bg-dark-surface text-sm text-gray-300 hover:border-neon-blue/40 hover:text-white"
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default MyCardsSection;
