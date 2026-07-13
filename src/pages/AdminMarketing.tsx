import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Loader2,
  Mail,
  Megaphone,
  Phone,
  RefreshCw,
  Send,
  Smartphone,
  Wallet,
  XCircle,
} from 'lucide-react';
import { getApiBase } from '../lib/getApiBase';
import { readResponseJson } from '../lib/parseResponseJson';
import { ADMIN_PASSWORD, getAdminAuthHeaders } from '../lib/adminAuth';
import {
  type MarketingBudgetView,
  previewDeduction,
} from '../lib/marketingBudget';

type Budget = MarketingBudgetView;

type FundRequest = {
  id: string;
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

const MANAGER_PHONE = '0997407598';
const SUPPORT_EMAIL = 'trickalholdings@gmail.com';

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(key: string): string {
  const [y, m] = key.split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatMoney(amount: number, currency: string): string {
  if (currency === 'MWK') return `MWK ${Math.round(amount).toLocaleString()}`;
  return `$${amount.toFixed(2)} USD`;
}

function payoutLabel(method: string): string {
  if (method === 'bank_transfer') return 'Bank transfer';
  if (method === 'mobile_money') return 'Mobile money';
  if (method === 'virtual_card') return 'Virtual card (USD)';
  return method;
}

function statusBadge(status: string) {
  const map: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
    pending: { cls: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30', icon: <Clock className="w-3.5 h-3.5" />, label: 'Pending approval' },
    approved: { cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30', icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Approved — processing' },
    rejected: { cls: 'bg-red-500/15 text-red-300 border-red-500/30', icon: <XCircle className="w-3.5 h-3.5" />, label: 'Rejected' },
    fulfilled: { cls: 'bg-green-500/15 text-green-300 border-green-500/30', icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Fulfilled' },
  };
  const s = map[status] ?? { cls: 'bg-gray-500/15 text-gray-300', icon: null, label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.cls}`}>
      {s.icon}
      {s.label}
    </span>
  );
}

function BudgetCard({ budget }: { budget: Budget }) {
  const pct = budget.allocatedUsd > 0
    ? Math.min(100, Math.round((budget.spentUsd / budget.allocatedUsd) * 100))
    : 0;

  return (
    <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-purple-400" />
          <span className="text-sm font-semibold text-gray-300">Monthly marketing budget</span>
        </div>
        <span className="text-xs text-gray-500">{budget.monthKey} · {budget.lots.length} allocation{budget.lots.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div className="rounded-xl bg-dark-surface/60 border border-amber-500/20 p-4">
          <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold mb-2">
            <Coins className="w-4 h-4" /> USD total
          </div>
          <p className="text-2xl font-bold text-white">${budget.balanceUsdRemaining.toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-1">
            remaining of ${budget.allocatedUsd.toFixed(2)} · spent ${budget.spentUsd.toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl bg-dark-surface/60 border border-green-500/20 p-4">
          <div className="flex items-center gap-2 text-green-300 text-xs font-semibold mb-2">
            <Banknote className="w-4 h-4" /> MWK total
          </div>
          <p className="text-2xl font-bold text-white">MWK {budget.balanceMwkRemaining.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">
            remaining of MWK {budget.allocatedMwk.toLocaleString()} · spent MWK {budget.spentMwk.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="h-2 rounded-full bg-dark-surface overflow-hidden mb-4">
        <div className="h-full rounded-full bg-purple-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      {budget.lots.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Allocations (each rate is fixed)</p>
          {budget.lots.map((lot, i) => (
            <div key={lot.id} className="flex flex-wrap justify-between gap-2 text-xs p-3 rounded-lg bg-dark-surface/50 border border-dark-border">
              <span className="text-gray-400">#{i + 1} · Rate {lot.rateMwk.toLocaleString()}/$</span>
              <span className="text-white font-mono">
                ${lot.balanceUsdRemaining.toFixed(2)} left · MWK {lot.balanceMwkRemaining.toLocaleString()} left
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminMarketing() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [monthKey] = useState(currentMonthKey());
  const [budget, setBudget] = useState<Budget | null>(null);
  const [requests, setRequests] = useState<FundRequest[]>([]);

  const [form, setForm] = useState({
    requestedByName: '',
    payoutMethod: 'mobile_money' as 'bank_transfer' | 'mobile_money' | 'virtual_card',
    amount: '',
    purpose: '',
    notes: '',
    bankName: '',
    bankAccountName: '',
    bankAccountNumber: '',
    mobileMoneyProvider: 'Airtel Money',
    mobileMoneyNumber: '',
    virtualCardEmail: '',
  });

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
      const base = getApiBase();
      const [budgetRes, reqRes] = await Promise.all([
        fetch(`${base}/marketing-funds/budgets?monthKey=${monthKey}`, { headers: headers() }),
        fetch(`${base}/marketing-funds/requests?monthKey=${monthKey}`, { headers: headers() }),
      ]);
      const budgetData = await readResponseJson<{ budget?: Budget | null; error?: string }>(budgetRes);
      const reqData = await readResponseJson<{ requests?: FundRequest[]; error?: string }>(reqRes);
      if (!budgetRes.ok) throw new Error(budgetData.error || 'Failed to load budget');
      if (!reqRes.ok) throw new Error(reqData.error || 'Failed to load requests');
      setBudget(budgetData.budget ?? null);
      setRequests(reqData.requests ?? []);
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

  const activeCurrency = form.payoutMethod === 'virtual_card' ? 'USD' : 'MWK';

  const amountPreview = useMemo(() => {
    const amt = Number(form.amount);
    if (!budget || !Number.isFinite(amt) || amt <= 0) return null;
    const plan = previewDeduction(budget.lots, amt, activeCurrency);
    if (!plan.ok) return { primary: activeCurrency === 'USD' ? `$${amt.toFixed(2)}` : `MWK ${Math.round(amt).toLocaleString()}`, secondary: 'Exceeds available budget', warn: true };
    return {
      primary: activeCurrency === 'USD' ? `$${amt.toFixed(2)}` : `MWK ${Math.round(amt).toLocaleString()}`,
      secondary: `Deducts $${plan.totalUsd.toFixed(2)} · MWK ${plan.totalMwk.toLocaleString()} (oldest allocation first)`,
      warn: false,
    };
  }, [form.amount, activeCurrency, budget]);

  const canSubmit = budget && (
    activeCurrency === 'USD' ? budget.balanceUsdRemaining > 0 : budget.balanceMwkRemaining > 0
  );

  const pendingTotal = useMemo(
    () => requests.filter((r) => r.status === 'pending').length,
    [requests]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${getApiBase()}/marketing-funds/requests`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ ...form, amount: Number(form.amount), monthKey }),
      });
      const data = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setForm((p) => ({
        ...p,
        amount: '',
        purpose: '',
        notes: '',
        bankAccountNumber: '',
        mobileMoneyNumber: '',
        virtualCardEmail: '',
      }));
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center px-4">
        <div className="card-dark p-8 rounded-2xl max-w-md w-full border border-purple-500/30">
          <div className="flex items-center gap-3 mb-4">
            <Megaphone className="w-8 h-8 text-purple-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Marketing Funds</h1>
              <p className="text-gray-400 text-sm">Team portal · /admin/marketing</p>
            </div>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={adminPass}
              onChange={(e) => setAdminPass(e.target.value)}
              placeholder="Admin password"
              className="w-full px-4 py-3 bg-dark-surface border border-dark-border rounded-lg text-white"
              autoFocus
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" className="w-full py-3 rounded-lg bg-purple-600 text-white font-semibold">
              Access Marketing Portal
            </button>
          </form>
          <p className="text-gray-500 text-xs mt-4 text-center">
            <Link to="/admin" className="text-neon-blue hover:underline">Back to admin</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Link to="/admin" className="text-gray-400 hover:text-purple-400">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Megaphone className="w-7 h-7 text-purple-400" />
                Marketing Funds
              </h1>
              <p className="text-gray-400 text-sm">{formatMonthLabel(monthKey)} · Request & track disbursements</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => loadData()}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-dark-border text-gray-300 text-sm flex items-center gap-2 hover:border-purple-500/40"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>
        )}

        {/* Budget overview */}
        <div className="mb-6">
          {loading && !budget ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : budget ? (
            <BudgetCard budget={budget} />
          ) : (
            <div className="card-dark p-6 rounded-xl border border-dark-border text-center text-gray-400">
              No budget allocated for this month yet. Contact management to load funds.
            </div>
          )}
        </div>

        {/* Info cards */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="card-dark p-4 rounded-xl border border-yellow-500/20 flex gap-3">
            <Phone className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-semibold text-sm">Delayed request?</p>
              <p className="text-gray-400 text-sm mt-1">
                If your request is taking too long, contact management at{' '}
                <a href={`tel:${MANAGER_PHONE}`} className="text-yellow-300 font-mono hover:underline">{MANAGER_PHONE}</a>
              </p>
            </div>
          </div>
          <div className="card-dark p-4 rounded-xl border border-blue-500/20 flex gap-3">
            <Mail className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-semibold text-sm">Need more funds this month?</p>
              <p className="text-gray-400 text-sm mt-1">
                Email{' '}
                <a href={`mailto:${SUPPORT_EMAIL}?subject=Marketing%20budget%20top-up%20${monthKey}`} className="text-blue-300 hover:underline">
                  {SUPPORT_EMAIL}
                </a>{' '}
                to request an additional allocation within the same month.
              </p>
            </div>
          </div>
        </div>

        {/* Request form */}
        <div className="card-dark p-6 rounded-2xl border border-purple-500/20 mb-6">
          <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
            <Send className="w-5 h-5 text-purple-400" />
            Request funds
          </h2>
          <p className="text-gray-400 text-sm mb-5">
            Request in MWK (bank / mobile money) or USD (virtual card). Spending uses the <strong className="text-gray-300">oldest allocation first</strong> — each batch keeps its own rate.
            {budget && (
              <span className="block mt-2 text-purple-300">
                Available: ${budget.balanceUsdRemaining.toFixed(2)} USD · MWK {budget.balanceMwkRemaining.toLocaleString()}
              </span>
            )}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Your name *</label>
                <input
                  required
                  value={form.requestedByName}
                  onChange={(e) => setForm((p) => ({ ...p, requestedByName: e.target.value }))}
                  placeholder="e.g. John — Marketing"
                  className="w-full px-3 py-2.5 bg-dark-surface border border-dark-border rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Amount *</label>
                <input
                  required
                  type="number"
                  min="1"
                  step={activeCurrency === 'USD' ? '0.01' : '1'}
                  value={form.amount}
                  onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder={activeCurrency === 'USD' ? 'e.g. 50' : 'e.g. 150000'}
                  className="w-full px-3 py-2.5 bg-dark-surface border border-dark-border rounded-lg text-white"
                />
                {amountPreview && (
                  <p className={`text-xs mt-1 ${amountPreview.warn ? 'text-red-400' : 'text-purple-300'}`}>
                    {amountPreview.primary} · {amountPreview.secondary}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-2">How do you want the funds? *</label>
              <div className="grid sm:grid-cols-3 gap-2">
                {([
                  { id: 'mobile_money', label: 'Mobile money', icon: Smartphone, sub: 'MWK' },
                  { id: 'bank_transfer', label: 'Bank transfer', icon: Wallet, sub: 'MWK' },
                  { id: 'virtual_card', label: 'Virtual card', icon: CreditCard, sub: 'USD' },
                ] as const).map((opt) => {
                  const Icon = opt.icon;
                  const selected = form.payoutMethod === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, payoutMethod: opt.id }))}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        selected
                          ? 'border-purple-500 bg-purple-500/15 text-white'
                          : 'border-dark-border bg-dark-surface text-gray-400 hover:border-purple-500/30'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mb-1 ${selected ? 'text-purple-300' : ''}`} />
                      <p className="font-semibold text-sm">{opt.label}</p>
                      <p className="text-xs opacity-70">{opt.sub}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Purpose / campaign *</label>
              <input
                required
                value={form.purpose}
                onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))}
                placeholder="e.g. Facebook ads — June promo"
                className="w-full px-3 py-2.5 bg-dark-surface border border-dark-border rounded-lg text-white"
              />
            </div>

            {form.payoutMethod === 'bank_transfer' && (
              <div className="grid md:grid-cols-3 gap-3 p-4 rounded-xl bg-dark-surface/50 border border-dark-border">
                <input required placeholder="Bank name *" value={form.bankName} onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))} className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm" />
                <input required placeholder="Account name *" value={form.bankAccountName} onChange={(e) => setForm((p) => ({ ...p, bankAccountName: e.target.value }))} className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm" />
                <input required placeholder="Account number *" value={form.bankAccountNumber} onChange={(e) => setForm((p) => ({ ...p, bankAccountNumber: e.target.value }))} className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm" />
              </div>
            )}

            {form.payoutMethod === 'mobile_money' && (
              <div className="grid md:grid-cols-2 gap-3 p-4 rounded-xl bg-dark-surface/50 border border-dark-border">
                <select
                  value={form.mobileMoneyProvider}
                  onChange={(e) => setForm((p) => ({ ...p, mobileMoneyProvider: e.target.value }))}
                  className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm"
                >
                  <option value="Airtel Money">Airtel Money</option>
                  <option value="TNM Mpamba">TNM Mpamba</option>
                  <option value="National Bank Mo626">National Bank Mo626</option>
                  <option value="FDH Mobile">FDH Mobile</option>
                  <option value="Other">Other</option>
                </select>
                <input
                  required
                  placeholder="Mobile number *"
                  value={form.mobileMoneyNumber}
                  onChange={(e) => setForm((p) => ({ ...p, mobileMoneyNumber: e.target.value }))}
                  className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm"
                />
              </div>
            )}

            {form.payoutMethod === 'virtual_card' && (
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <input
                  required
                  type="email"
                  placeholder="Email to receive virtual card details *"
                  value={form.virtualCardEmail}
                  onChange={(e) => setForm((p) => ({ ...p, virtualCardEmail: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-dark-surface border border-dark-border rounded-lg text-white text-sm"
                />
                <p className="text-xs text-amber-200/70 mt-2">USD virtual card — deducted from the USD marketing pool.</p>
              </div>
            )}

            <textarea
              placeholder="Extra notes (optional)"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2.5 bg-dark-surface border border-dark-border rounded-lg text-white text-sm"
            />

            <button
              type="submit"
              disabled={submitting || !canSubmit}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              Submit request
            </button>
          </form>
        </div>

        {/* Request history */}
        <div className="card-dark p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Your requests</h2>
            {pendingTotal > 0 && (
              <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">
                {pendingTotal} pending
              </span>
            )}
          </div>
          {requests.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No requests yet this month.</p>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => (
                <div key={r.id} className="p-4 rounded-xl border border-dark-border bg-dark-surface/40">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-bold text-white">{formatMoney(r.amount, r.currency)}</p>
                      <p className="text-sm text-gray-400">{payoutLabel(r.payoutMethod)} · {r.purpose}</p>
                      {(r.deductedUsd != null || r.deductedMwk != null) && (
                        <p className="text-xs text-gray-500 mt-1">
                          Deducted: ${r.deductedUsd?.toFixed(2) ?? '—'} · MWK {r.deductedMwk?.toLocaleString() ?? '—'}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">By {r.requestedByName} · {new Date(r.createdAt).toLocaleString()}</p>
                    </div>
                    {statusBadge(r.status)}
                  </div>
                  {r.managerNote && (
                    <p className="text-xs text-gray-400 mt-2 border-t border-dark-border pt-2">
                      Management note: {r.managerNote}
                    </p>
                  )}
                  {r.status === 'approved' && (
                    <p className="text-xs text-blue-300 mt-2">
                      Funds approved — balance deducted. Processing payout. Delay? Call {MANAGER_PHONE}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
