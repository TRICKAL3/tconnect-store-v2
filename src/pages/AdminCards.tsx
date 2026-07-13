import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CreditCard, Loader2, Plus, RefreshCw, Search, Send } from 'lucide-react';
import { getApiBase } from '../lib/getApiBase';
import { readResponseJson } from '../lib/parseResponseJson';
import { ADMIN_PASSWORD, getAdminAuthHeaders } from '../lib/adminAuth';
import {
  buildTxnDedupeKey,
  EMPTY_MANUAL_TXN_ROW,
  parseManualTxnRows,
  rowHasManualTxnInput,
  type ManualTxnRow,
} from '../lib/parseSwypeTransactions';
import AdminTxnEntryTable from '../components/AdminTxnEntryTable';
import VirtualCardTxnTable from '../components/VirtualCardTxnTable';
import {
  VIRTUAL_CARD_STATUSES,
  virtualCardStatusLabel,
} from '../lib/virtualCardStatus';

type CardRow = {
  id: string;
  label: string;
  cardLast4: string | null;
  balanceUsd: number;
  cardValueUsd: number;
  totalFeesUsd: number;
  totalSpendingsUsd: number;
  status: string;
  orderNumber: string | null;
  updateRequestedAt: string | null;
  lastSyncedAt?: string | null;
  fulfilledAt?: string | null;
  awaitingUserRefresh?: boolean;
  adminNotes?: string | null;
  transactionCount?: number;
  cardDetails?: { cardNumber: string; expireDate: string; cvv: string } | null;
  user: { id: string; email: string; name: string };
  transactions: Array<{
    swypeTxnId: string | null;
    occurredAt: string;
    merchant: string | null;
    amountUsd: number;
    feeUsd?: number;
    totalUsd?: number;
    status?: string;
    type?: string;
    notes?: string | null;
  }>;
};

const AdminCards: React.FC = () => {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState<'pending' | 'all' | 'history'>('pending');
  const [pending, setPending] = useState<CardRow[]>([]);
  const [allCards, setAllCards] = useState<CardRow[]>([]);
  const [history, setHistory] = useState<CardRow[]>([]);
  const [emailSearch, setEmailSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    cardLast4: '',
    balanceUsd: '',
    totalFeesUsd: '',
    totalSpendingsUsd: '',
    status: 'active',
  });
  const [cardValueUsd, setCardValueUsd] = useState(0);
  const [txnRows, setTxnRows] = useState<ManualTxnRow[]>([{ ...EMPTY_MANUAL_TXN_ROW }]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cardDetail, setCardDetail] = useState<CardRow | null>(null);

  const cardMap = useMemo(() => {
    const m = new Map<string, CardRow>();
    for (const c of [...pending, ...allCards, ...history]) m.set(c.id, c);
    if (cardDetail) m.set(cardDetail.id, cardDetail);
    return m;
  }, [pending, allCards, history, cardDetail]);

  const selected = selectedId ? cardMap.get(selectedId) ?? null : null;

  const existingTxnKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const t of cardDetail?.transactions ?? []) {
      keys.add(
        buildTxnDedupeKey({
          swypeTxnId: t.swypeTxnId,
          merchant: t.merchant,
          occurredAt: t.occurredAt,
          amountUsd: t.amountUsd,
          totalUsd: t.totalUsd,
        })
      );
    }
    return keys;
  }, [cardDetail]);

  const tryLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setAuthed(true);
      setPassword('');
    } else alert('Wrong password');
  };

  const headers = useCallback(
    () => getAdminAuthHeaders(authed) as HeadersInit,
    [authed]
  );

  const loadAll = useCallback(async () => {
    if (!authed) return;
    setLoading(true);
    try {
      const q = emailSearch.trim() ? `?email=${encodeURIComponent(emailSearch.trim())}` : '';
      const [pendingRes, historyRes, listRes] = await Promise.all([
        fetch(`${getApiBase()}/user-cards/admin/refresh-requests`, { headers: headers() }),
        fetch(`${getApiBase()}/user-cards/admin/fulfilled-history`, { headers: headers() }),
        fetch(`${getApiBase()}/user-cards/admin/list${q}`, { headers: headers() }),
      ]);
      const pendingData = await readResponseJson(pendingRes);
      const historyData = await readResponseJson(historyRes);
      const listData = await readResponseJson(listRes);

      const errors: string[] = [];
      let pList: CardRow[] = [];
      let hList: CardRow[] = [];
      let aList: CardRow[] = [];

      if (pendingRes.ok) {
        pList = Array.isArray((pendingData as { requests?: unknown }).requests)
          ? (pendingData as { requests: CardRow[] }).requests
          : [];
        setPending(pList);
      } else {
        errors.push((pendingData as { error?: string }).error || 'Failed to load requests');
        setPending([]);
      }

      if (historyRes.ok) {
        hList = Array.isArray((historyData as { history?: unknown }).history)
          ? (historyData as { history: CardRow[] }).history
          : [];
        setHistory(hList);
      } else {
        errors.push((historyData as { error?: string }).error || 'Failed to load history');
        setHistory([]);
      }

      if (listRes.ok) {
        aList = Array.isArray((listData as { cards?: unknown }).cards)
          ? (listData as { cards: CardRow[] }).cards
          : [];
        setAllCards(aList);
      } else {
        errors.push((listData as { error?: string }).error || 'Failed to load cards');
        setAllCards([]);
      }

      if (errors.length > 0) setMessage(errors.join(' · '));

      const fromUrl = new URLSearchParams(window.location.search).get('cardId');
      if (fromUrl) {
        if (pList.some((r) => r.id === fromUrl)) {
          setSelectedId(fromUrl);
          setTab('pending');
        } else if (aList.some((r) => r.id === fromUrl) || hList.some((r) => r.id === fromUrl)) {
          setSelectedId(fromUrl);
        }
      }
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [authed, headers, emailSearch]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!authed || selectedId) return;
    const id = window.setInterval(() => loadAll(), 20000);
    return () => window.clearInterval(id);
  }, [authed, selectedId, loadAll]);

  useEffect(() => {
    if (!selectedId || !authed) {
      setCardDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    fetch(`${getApiBase()}/user-cards/admin/${selectedId}`, { headers: headers() })
      .then((res) => readResponseJson(res).then((data) => ({ res, data })))
      .then(({ res, data }) => {
        if (cancelled) return;
        if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to load card');
        const card = (data as { card?: CardRow }).card;
        if (card) setCardDetail(card);
      })
      .catch((e: unknown) => {
        if (!cancelled) setMessage(e instanceof Error ? e.message : 'Failed to load card detail');
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, authed, headers]);

  useEffect(() => {
    const card = cardDetail ?? selected;
    if (!card) return;
    setForm({
      cardLast4: card.cardLast4 ?? '',
      balanceUsd: String(card.balanceUsd),
      totalFeesUsd: String(card.totalFeesUsd ?? 0),
      totalSpendingsUsd: String(card.totalSpendingsUsd ?? 0),
      status: card.status || 'active',
    });
    setCardValueUsd(card.cardValueUsd ?? 0);
    setTxnRows([{ ...EMPTY_MANUAL_TXN_ROW }]);
  }, [cardDetail, selected]);

  const sendUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;

    const filledRows = txnRows.filter(rowHasManualTxnInput);
    const transactions = parseManualTxnRows(txnRows);
    if (filledRows.length > 0 && transactions.length === 0) {
      alert('Transactions could not be saved — fill merchant, date & time, and amounts on each row.');
      return;
    }
    const invalidCount = filledRows.filter((row) => !parseManualTxnRows([row]).length).length;
    if (invalidCount > 0) {
      alert(`${invalidCount} row(s) have invalid data. Fix merchant, date, and amounts before sending.`);
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const transactionsPayload = transactions.map((t) => ({
        swypeTxnId: t.swypeTxnId,
        occurredAt: t.occurredAt,
        merchant: t.merchant,
        amountUsd: t.amountUsd,
        feeUsd: t.feeUsd,
        totalUsd: t.totalUsd,
        status: t.status,
        type: t.type,
        location: t.location,
      }));

      const last4FromTxns = transactions.find((t) => t.cardLast4)?.cardLast4;

      const res = await fetch(`${getApiBase()}/user-cards/admin/${selected.id}/send-update`, {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardLast4: form.cardLast4.trim() || last4FromTxns || undefined,
          balanceUsd: Number(form.balanceUsd),
          totalFeesUsd: Number(form.totalFeesUsd),
          totalSpendingsUsd: Number(form.totalSpendingsUsd),
          status: form.status,
          transactions: transactionsPayload,
        }),
      });
      const data = await readResponseJson(res);
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Send failed');
      const merge = (data as { mergeStats?: { added: number; updated: number } }).mergeStats;
      const parts = ['Card updated — customer will see changes automatically.'];
      if (merge) {
        if (merge.added > 0) parts.push(`${merge.added} new transaction(s) added.`);
        if (merge.updated > 0) parts.push(`${merge.updated} existing transaction(s) refreshed.`);
        if (transactions.length === 0) parts.push('Balance updated (no new transactions).');
      }
      setMessage(parts.join(' '));
      setSelectedId(null);
      setCardDetail(null);
      await loadAll();
      setTab('history');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setBusy(false);
    }
  };

  const renderCardButton = (r: CardRow, accent?: 'amber' | 'default', showCardNumber = false) => (
    <button
      key={r.id}
      type="button"
      onClick={() => setSelectedId(r.id)}
      className={`w-full text-left rounded-xl border px-4 py-4 transition-colors ${
        accent === 'amber'
          ? 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10'
          : 'border-dark-border bg-dark-surface/40 hover:bg-dark-surface/70'
      }`}
    >
      <p className="font-semibold">{r.user.name}</p>
      <p className="text-sm text-gray-400">{r.user.email}</p>
      <p className="text-sm text-gray-300 mt-1">
        {r.label}
        {r.orderNumber && <span className="text-gray-500"> · #{r.orderNumber}</span>}
      </p>
      {showCardNumber && (
        <p className="text-xs mt-2 font-mono text-neon-blue/90 break-all">
          {r.cardDetails?.cardNumber
            ? `Card ${r.cardDetails.cardNumber}`
            : r.cardLast4
              ? `Card •••• ${r.cardLast4}`
              : 'Card number not on file yet'}
          {r.cardDetails?.expireDate && (
            <span className="text-gray-500 font-sans ml-2">exp {r.cardDetails.expireDate}</span>
          )}
        </p>
      )}
      <p className="text-xs text-gray-500 mt-1">
        Balance ${r.balanceUsd.toFixed(2)}
        {typeof r.transactionCount === 'number' && (
          <span className="text-gray-400"> · {r.transactionCount} transaction(s)</span>
        )}
        {r.updateRequestedAt && (
          <span className="text-amber-300/90 ml-2">
            · Requested {new Date(r.updateRequestedAt).toLocaleString()}
          </span>
        )}
        {r.lastSyncedAt && !r.updateRequestedAt && (
          <span className="ml-2">· Updated {new Date(r.lastSyncedAt).toLocaleString()}</span>
        )}
      </p>
      {r.adminNotes && (
        <p className="text-[10px] text-gray-600 mt-1 line-clamp-2">{r.adminNotes}</p>
      )}
    </button>
  );

  if (!authed) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center px-4">
        <form onSubmit={tryLogin} className="card-dark p-8 rounded-2xl border border-dark-border w-full max-w-sm">
          <CreditCard className="w-10 h-10 text-neon-blue mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white text-center mb-4">Card Updates</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            className="w-full px-4 py-3 rounded-lg bg-dark-surface border border-dark-border text-white mb-4"
          />
          <button type="submit" className="w-full btn-cyber py-3 rounded-lg font-semibold text-white">
            Enter
          </button>
          <Link to="/admin" className="block text-center text-sm text-gray-500 mt-4 hover:text-neon-blue">
            ← Back to admin
          </Link>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-neon-blue mb-4">
          <ArrowLeft className="w-4 h-4" />
          Admin home
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-1">Card updates</h1>
            <p className="text-xs text-gray-500">
              Paste only new transactions. Same columns the customer sees: merchant, date, amount, fee, total,
              status.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadAll()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dark-border text-sm font-medium hover:border-neon-blue/40 hover:text-neon-blue disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {message && (
          <div
            className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              message.includes('updated') || message.includes('added')
                ? 'border-green-500/30 bg-green-500/10 text-green-300'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
            }`}
          >
            {message}
          </div>
        )}

        {!selected ? (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                type="button"
                onClick={() => setTab('pending')}
                className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                  tab === 'pending'
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-200'
                    : 'border-dark-border text-gray-400'
                }`}
              >
                Requests ({pending.length})
              </button>
              <button
                type="button"
                onClick={() => setTab('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                  tab === 'all'
                    ? 'border-neon-blue/50 bg-neon-blue/10 text-neon-blue'
                    : 'border-dark-border text-gray-400'
                }`}
              >
                All cards
              </button>
              <button
                type="button"
                onClick={() => setTab('history')}
                className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                  tab === 'history'
                    ? 'border-green-500/50 bg-green-500/10 text-green-300'
                    : 'border-dark-border text-gray-400'
                }`}
              >
                History ({history.length})
              </button>
            </div>

            {tab === 'all' && (
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    value={emailSearch}
                    onChange={(e) => setEmailSearch(e.target.value)}
                    placeholder="Search by customer email"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-dark-surface border border-dark-border text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => loadAll()}
                  className="px-4 py-2.5 rounded-lg border border-dark-border text-sm hover:border-neon-blue/40"
                >
                  Search
                </button>
              </div>
            )}

            <div className="card-dark rounded-2xl border border-dark-border p-5">
              {loading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                </div>
              )}
              {!loading && tab === 'pending' && (
                <ul className="space-y-2">
                  {pending.length === 0 ? (
                    <p className="text-gray-500 text-sm py-6 text-center">
                      No pending requests. Check <strong className="text-gray-400 font-medium">All cards</strong> to
                      update any customer card, or tap Refresh after a customer requests an update.
                    </p>
                  ) : (
                    pending.map((r) => <li key={r.id}>{renderCardButton(r, 'amber')}</li>)
                  )}
                </ul>
              )}
              {!loading && tab === 'all' && (
                <ul className="space-y-2">
                  {allCards.length === 0 ? (
                    <p className="text-gray-500 text-sm py-6 text-center">No cards found.</p>
                  ) : (
                    allCards.map((r) => <li key={r.id}>{renderCardButton(r, 'default', true)}</li>)
                  )}
                </ul>
              )}
              {!loading && tab === 'history' && (
                <ul className="space-y-2">
                  {history.length === 0 ? (
                    <p className="text-gray-500 text-sm py-6 text-center">No update history yet.</p>
                  ) : (
                    history.map((r) => <li key={r.id}>{renderCardButton(r)}</li>)
                  )}
                </ul>
              )}
            </div>
          </>
        ) : (
          <form onSubmit={sendUpdate} className="space-y-5">
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="text-sm text-gray-400 hover:text-neon-blue"
            >
              ← Back
            </button>

            <div className="rounded-xl border border-neon-blue/30 bg-neon-blue/5 px-4 py-3">
              <p className="font-semibold">{selected.user.name}</p>
              <p className="text-sm text-gray-400">{selected.user.email}</p>
              <p className="text-sm text-gray-300 mt-1">{selected.label}</p>
              {selected.updateRequestedAt && (
                <p className="text-xs text-amber-300 mt-1">
                  Customer requested refresh {new Date(selected.updateRequestedAt).toLocaleString()}
                </p>
              )}
              {cardDetail?.adminNotes && (
                <p className="text-xs text-gray-500 mt-2 border-t border-neon-blue/20 pt-2">
                  {cardDetail.adminNotes}
                </p>
              )}
            </div>

            {detailLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading card history…
              </div>
            )}

            {!detailLoading && cardDetail && cardDetail.transactions.length > 0 && (
              <div className="card-dark rounded-2xl border border-dark-border p-5 space-y-3">
                <h2 className="font-semibold text-sm text-gray-400">
                  Already on customer card ({cardDetail.transactionCount ?? cardDetail.transactions.length})
                </h2>
                <p className="text-xs text-gray-500">
                  These stay visible to the customer. Paste only rows that are not listed here.
                </p>
                <div className="overflow-x-auto max-h-48 overflow-y-auto rounded-lg border border-dark-border">
                  <VirtualCardTxnTable
                    compact
                    rows={cardDetail.transactions.map((t) => ({
                      id: t.swypeTxnId || undefined,
                      swypeTxnId: t.swypeTxnId,
                      merchant: t.merchant,
                      occurredAt: t.occurredAt,
                      amountUsd: t.amountUsd,
                      feeUsd: t.feeUsd,
                      totalUsd: t.totalUsd,
                      status: t.status,
                    }))}
                    getRowKey={(t, i) => t.swypeTxnId || String(i)}
                  />
                </div>
              </div>
            )}

            <div className="card-dark rounded-2xl border border-dark-border p-5 space-y-4">
              <h2 className="font-semibold text-sm text-gray-400">Quick update</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block text-sm">
                  <span className="text-gray-500 text-xs mb-1 block">Available balance (USD)</span>
                  <input
                    required
                    autoFocus
                    value={form.balanceUsd}
                    onChange={(e) => setForm((f) => ({ ...f, balanceUsd: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-dark-surface border border-neon-blue/30 text-lg font-semibold"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-gray-500 text-xs mb-1 block">Total spendings (USD)</span>
                  <input
                    value={form.totalSpendingsUsd}
                    onChange={(e) => setForm((f) => ({ ...f, totalSpendingsUsd: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-dark-surface border border-dark-border"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-gray-500 text-xs mb-1 block">Total fees (USD)</span>
                  <input
                    value={form.totalFeesUsd}
                    onChange={(e) => setForm((f) => ({ ...f, totalFeesUsd: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-dark-surface border border-dark-border"
                  />
                </label>
              </div>
              <div className="grid sm:grid-cols-3 gap-3 pt-2 border-t border-dark-border">
                <div className="text-sm">
                  <span className="text-gray-500 text-xs block mb-1">Card value (original)</span>
                  <p className="px-3 py-2.5 rounded-lg bg-dark-bg/80 border border-dark-border text-gray-300 font-semibold">
                    ${cardValueUsd.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-gray-600 mt-1">Fixed at purchase — not editable</p>
                </div>
                <label className="block text-sm">
                  <span className="text-gray-500 text-xs mb-1 block">Card status</span>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-dark-surface border border-dark-border"
                  >
                    {VIRTUAL_CARD_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {virtualCardStatusLabel(s)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-gray-500 text-xs mb-1 block">Last 4 digits (optional)</span>
                  <input
                    value={form.cardLast4}
                    onChange={(e) => setForm((f) => ({ ...f, cardLast4: e.target.value }))}
                    placeholder="Optional"
                    className="w-full px-3 py-2 rounded-lg bg-dark-surface border border-dark-border"
                  />
                </label>
              </div>
            </div>

            <div className="card-dark rounded-2xl border border-dark-border p-5 space-y-3">
              <div>
                <h2 className="font-semibold text-sm text-gray-400 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Transactions
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Add rows below — merchant, date &amp; time, amount, fee, total, status. Use{' '}
                  <strong className="text-gray-400 font-medium">Add row</strong> for more, or{' '}
                  <strong className="text-gray-400 font-medium">Import clipboard</strong> to load many at once.
                </p>
              </div>
              <AdminTxnEntryTable rows={txnRows} onChange={setTxnRows} existingTxnKeys={existingTxnKeys} />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 btn-cyber py-3 rounded-xl font-bold disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              Send update to customer
            </button>
            <p className="text-center text-[11px] text-gray-600">
              Leave transactions empty to update balance only and clear the refresh request.
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default AdminCards;
