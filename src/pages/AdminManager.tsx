import React, { useCallback, useEffect, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  Coins,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Shield,
  XCircle,
} from 'lucide-react';
import { getApiBase } from '../lib/getApiBase';
import { readResponseJson } from '../lib/parseResponseJson';
import { ADMIN_PASSWORD, getAdminAuthHeaders } from '../lib/adminAuth';
import { type MarketingBudgetView, previewDeduction } from '../lib/marketingBudget';

type Budget = MarketingBudgetView;

type FundRequest = {
  id: string;
  monthKey: string | null;
  requestedByName: string;
  amount: number;
  currency: string;
  payoutMethod: string;
  purpose: string;
  notes: string | null;
  status: string;
  managerNote: string | null;
  deductedUsd: number | null;
  deductedMwk: number | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  mobileMoneyProvider: string | null;
  mobileMoneyNumber: string | null;
  virtualCardEmail: string | null;
  createdAt: string;
  reviewedAt: string | null;
  fulfilledAt: string | null;
};

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMoney(amount: number, currency: string): string {
  if (currency === 'MWK') return `MWK ${Math.round(amount).toLocaleString()}`;
  return `$${amount.toFixed(2)}`;
}

function payoutLabel(method: string): string {
  if (method === 'bank_transfer') return 'Bank transfer';
  if (method === 'mobile_money') return 'Mobile money';
  if (method === 'virtual_card') return 'Virtual card';
  return method;
}

function payoutDetails(r: FundRequest): string {
  if (r.payoutMethod === 'bank_transfer') {
    return `${r.bankName} · ${r.bankAccountName} · ${r.bankAccountNumber}`;
  }
  if (r.payoutMethod === 'mobile_money') {
    return `${r.mobileMoneyProvider} · ${r.mobileMoneyNumber}`;
  }
  if (r.payoutMethod === 'virtual_card') {
    return r.virtualCardEmail ?? '—';
  }
  return '—';
}

export default function AdminManager() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [budget, setBudget] = useState<Budget | null>(null);
  const [requests, setRequests] = useState<FundRequest[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const [budgetForm, setBudgetForm] = useState({
    amountUsd: '',
    rateMwk: '',
    notes: '',
  });
  const [resetConfirm, setResetConfirm] = useState('');
  const [showReset, setShowReset] = useState(false);

  const headers = useCallback(
    () => ({
      'Content-Type': 'application/json',
      ...getAdminAuthHeaders(isAuthenticated),
    }),
    [isAuthenticated]
  );

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${getApiBase()}/marketing-funds/manager/overview?monthKey=${monthKey}`, {
        headers: headers(),
      });
      const data = await readResponseJson<{
        budget?: Budget | null;
        requests?: FundRequest[];
        pendingCount?: number;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setBudget(data.budget ?? null);
      setRequests(data.requests ?? []);
      setPendingCount(data.pendingCount ?? 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, headers, monthKey]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPass === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Invalid password');
    }
  };

  const handleBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setActing('budget');
    setError('');
    try {
      const res = await fetch(`${getApiBase()}/marketing-funds/manager/budgets`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          monthKey,
          amountUsd: Number(budgetForm.amountUsd),
          rateMwk: Number(budgetForm.rateMwk),
          notes: budgetForm.notes || undefined,
        }),
      });
      const data = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Failed to save budget');
      setBudgetForm((p) => ({ ...p, amountUsd: '', notes: '' }));
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setActing(null);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setActing('reset');
    setError('');
    try {
      const res = await fetch(`${getApiBase()}/marketing-funds/manager/reset`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ monthKey, confirm: resetConfirm }),
      });
      const data = await readResponseJson<{ error?: string; message?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Reset failed');
      setResetConfirm('');
      setShowReset(false);
      if (data.message) alert(data.message);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setActing(null);
    }
  };

  const handleAction = async (id: string, action: 'approve' | 'reject' | 'fulfill') => {
    setActing(id + action);
    setError('');
    try {
      const res = await fetch(`${getApiBase()}/marketing-funds/manager/requests/${id}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ action, managerNote: notes[id] || undefined }),
      });
      const data = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Action failed');
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setActing(null);
    }
  };

  const pending = requests.filter((r) => r.status === 'pending');
  const approved = requests.filter((r) => r.status === 'approved');

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="p-8 rounded-2xl max-w-md w-full border border-slate-700/50 bg-slate-900/80 backdrop-blur">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-8 h-8 text-slate-300" />
            <div>
              <h1 className="text-xl font-bold text-white">Management</h1>
              <p className="text-slate-500 text-xs">Restricted access</p>
            </div>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={adminPass}
              onChange={(e) => setAdminPass(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
              autoFocus
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" className="w-full py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold">
              Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-200">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Shield className="w-6 h-6 text-slate-400" />
              Marketing fund control
            </h1>
            <p className="text-slate-500 text-sm">Approve requests · allocate budgets · mark fulfilled</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
            />
            <button
              type="button"
              onClick={() => loadData()}
              disabled={loading}
              className="px-3 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm flex items-center gap-1"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>
        )}

        {/* Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <p className="text-xs text-slate-500">Pending requests</p>
            <p className="text-2xl font-bold text-yellow-400">{pendingCount}</p>
          </div>
          {budget ? (
            <>
              <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/20">
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Coins className="w-3 h-3" /> USD remaining
                </p>
                <p className="text-2xl font-bold text-white">${budget.balanceUsdRemaining.toFixed(2)}</p>
                <p className="text-xs text-slate-500">of ${budget.allocatedUsd.toFixed(2)} · {budget.lots.length} lot{budget.lots.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 border border-green-500/20">
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Banknote className="w-3 h-3" /> MWK remaining
                </p>
                <p className="text-2xl font-bold text-white">MWK {budget.balanceMwkRemaining.toLocaleString()}</p>
                <p className="text-xs text-slate-500">of MWK {budget.allocatedMwk.toLocaleString()}</p>
              </div>
            </>
          ) : (
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 sm:col-span-2">
              <p className="text-sm text-slate-500">No budget set for this month</p>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Budget allocation */}
          <div className="lg:col-span-1">
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
              <h2 className="font-bold text-white mb-1 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                New allocation
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Each allocation is separate — a new rate never changes money already allocated at an older rate.
              </p>
              <form onSubmit={handleBudget} className="space-y-3">
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Amount USD *"
                  value={budgetForm.amountUsd}
                  onChange={(e) => setBudgetForm((p) => ({ ...p, amountUsd: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                />
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Rate MWK per $1 *"
                  value={budgetForm.rateMwk}
                  onChange={(e) => setBudgetForm((p) => ({ ...p, rateMwk: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                />
                {budgetForm.amountUsd && budgetForm.rateMwk && (
                  <p className="text-xs text-emerald-400">
                    This batch: MWK {Math.round(Number(budgetForm.amountUsd) * Number(budgetForm.rateMwk)).toLocaleString()} at {Number(budgetForm.rateMwk).toLocaleString()}/$ — locked
                  </p>
                )}
                <input
                  placeholder="Notes (optional)"
                  value={budgetForm.notes}
                  onChange={(e) => setBudgetForm((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                />
                <button
                  type="submit"
                  disabled={acting === 'budget'}
                  className="w-full py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-sm disabled:opacity-50"
                >
                  {acting === 'budget' ? 'Saving…' : 'Add allocation'}
                </button>
              </form>

              {budget && budget.lots.length > 0 && (
                <div className="mt-5 pt-5 border-t border-slate-800">
                  <p className="text-xs text-slate-500 font-semibold mb-2 uppercase">Allocation lots</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {budget.lots.map((lot, i) => (
                      <div key={lot.id} className="text-xs p-2 rounded bg-slate-800/60 border border-slate-700">
                        <p className="text-slate-300 font-semibold">#{i + 1} · {lot.rateMwk.toLocaleString()} MWK/$</p>
                        <p className="text-slate-500 font-mono mt-1">
                          ${lot.balanceUsdRemaining.toFixed(2)} / ${lot.allocatedUsd.toFixed(2)} USD
                        </p>
                        <p className="text-slate-500 font-mono">
                          MWK {lot.balanceMwkRemaining.toLocaleString()} / {lot.allocatedMwk.toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5 pt-5 border-t border-red-900/40">
                {!showReset ? (
                  <button
                    type="button"
                    disabled={!budget?.lots.length || !!acting}
                    onClick={() => setShowReset(true)}
                    className="w-full py-2.5 rounded-lg border border-red-800/60 text-red-300 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-red-950/40 disabled:opacity-40"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset all allocations to zero
                  </button>
                ) : (
                  <form onSubmit={handleReset} className="space-y-3">
                    <p className="text-xs text-red-300">
                      Clears every allocation batch for <span className="font-mono">{monthKey}</span>. Request history is kept. Pending requests will have no funds until you allocate again.
                    </p>
                    <input
                      required
                      placeholder={`Type ${monthKey} to confirm`}
                      value={resetConfirm}
                      onChange={(e) => setResetConfirm(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-red-800/50 rounded-lg text-white text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setShowReset(false); setResetConfirm(''); }}
                        className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-400 text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={acting === 'reset' || resetConfirm !== monthKey}
                        className="flex-1 py-2 rounded-lg bg-red-900 hover:bg-red-800 text-white text-sm font-semibold disabled:opacity-50"
                      >
                        {acting === 'reset' ? 'Resetting…' : 'Confirm reset'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>

          {/* Pending queue */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="font-bold text-white">Pending approval ({pending.length})</h2>
            {loading && !requests.length ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-500" /></div>
            ) : pending.length === 0 ? (
              <p className="text-slate-500 text-sm p-6 rounded-xl bg-slate-900 border border-slate-800 text-center">No pending requests.</p>
            ) : (
              pending.map((r) => (
                <div key={r.id} className="p-5 rounded-xl bg-slate-900 border border-yellow-500/20">
                  <div className="flex flex-wrap justify-between gap-2 mb-3">
                    <div>
                      <p className="text-xl font-bold text-white">{formatMoney(r.amount, r.currency)}</p>
                      {budget && (() => {
                        const plan = previewDeduction(budget.lots, r.amount, r.currency as 'MWK' | 'USD');
                        return plan.ok ? (
                          <p className="text-xs text-slate-500">
                            Will deduct ${plan.totalUsd.toFixed(2)} · MWK {plan.totalMwk.toLocaleString()} (FIFO)
                          </p>
                        ) : null;
                      })()}
                      <p className="text-sm text-slate-400">{r.requestedByName} · {payoutLabel(r.payoutMethod)}</p>
                      <p className="text-sm text-slate-300 mt-1">{r.purpose}</p>
                    </div>
                    <span className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-xs font-mono text-slate-400 bg-slate-800/50 p-2 rounded mb-3">{payoutDetails(r)}</p>
                  {r.notes && <p className="text-xs text-slate-500 mb-3">Note: {r.notes}</p>}
                  <input
                    placeholder="Manager note (optional)"
                    value={notes[r.id] ?? ''}
                    onChange={(e) => setNotes((p) => ({ ...p, [r.id]: e.target.value }))}
                    className="w-full px-3 py-2 mb-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!!acting}
                      onClick={() => handleAction(r.id, 'approve')}
                      className="flex-1 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      {acting === r.id + 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={!!acting}
                      onClick={() => handleAction(r.id, 'reject')}
                      className="flex-1 py-2 rounded-lg bg-red-900/60 hover:bg-red-800 text-white text-sm font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      {acting === r.id + 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}

            {approved.length > 0 && (
              <>
                <h2 className="font-bold text-white mt-8">Approved — awaiting fulfillment ({approved.length})</h2>
                {approved.map((r) => (
                  <div key={r.id} className="p-4 rounded-xl bg-slate-900 border border-blue-500/20">
                    <div className="flex flex-wrap justify-between gap-2 mb-2">
                      <div>
                        <p className="font-bold text-white">{formatMoney(r.amount, r.currency)} · {r.requestedByName}</p>
                        <p className="text-xs text-slate-400">{payoutLabel(r.payoutMethod)} · {payoutDetails(r)}</p>
                      </div>
                      <button
                        type="button"
                        disabled={!!acting}
                        onClick={() => handleAction(r.id, 'fulfill')}
                        className="px-4 py-2 rounded-lg bg-blue-800 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50"
                      >
                        {acting === r.id + 'fulfill' ? '…' : 'Mark fulfilled'}
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            <h2 className="font-bold text-white mt-8">All requests this view</h2>
            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-slate-500 text-xs">
                  <tr>
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Who</th>
                    <th className="text-left p-3">Amount</th>
                    <th className="text-left p-3">Method</th>
                    <th className="text-left p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} className="border-t border-slate-800/80">
                      <td className="p-3 text-slate-500 text-xs">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="p-3">{r.requestedByName}</td>
                      <td className="p-3 font-mono">{formatMoney(r.amount, r.currency)}</td>
                      <td className="p-3 text-slate-400">{payoutLabel(r.payoutMethod)}</td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          r.status === 'pending' ? 'bg-yellow-500/15 text-yellow-300' :
                          r.status === 'approved' ? 'bg-blue-500/15 text-blue-300' :
                          r.status === 'fulfilled' ? 'bg-green-500/15 text-green-300' :
                          'bg-red-500/15 text-red-300'
                        }`}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
