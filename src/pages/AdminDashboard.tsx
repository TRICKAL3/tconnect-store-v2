import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  Coins,
  Download,
  Loader2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { getApiBase } from '../lib/getApiBase';
import { readResponseJson } from '../lib/parseResponseJson';
import { ADMIN_PASSWORD, getAdminAuthHeaders } from '../lib/adminAuth';
import { downloadUsdtInventoryExcel } from '../lib/exportUsdtInventoryExcel';
import { downloadMwkInventoryExcel } from '../lib/exportMwkInventoryExcel';
import {
  MWK_IN_PURPOSES,
  MWK_OUT_PURPOSES,
  mwkPurposeLabel,
  type MwkSnapshot,
} from '../lib/mwkLedger';

export type InventorySnapshot = {
  balanceUsd: number;
  avgBuyRateMwk: number;
  totalCostBasisMwk: number;
  totalInUsd: number;
  totalOutUsd: number;
  realizedProfitLossMwk: number;
};

type UsdtLedgerEntry = {
  id: string;
  direction: string;
  quantityUsd: number;
  buyRateMwk: number | null;
  sellRateMwk: number | null;
  costBasisMwk: number | null;
  revenueMwk: number | null;
  profitLossMwk: number | null;
  purpose: string | null;
  reference: string | null;
  notes: string | null;
  balanceAfterUsd: number | null;
  createdAt: string;
};

type MwkLedgerEntry = {
  id: string;
  direction: string;
  quantityMwk: number | null;
  purpose: string | null;
  purposeLabel?: string;
  reference: string | null;
  notes: string | null;
  balanceAfterMwk: number | null;
  createdAt: string;
};

const USDT_OUT_PURPOSES = [
  { value: 'virtual_card', label: 'Virtual card sale' },
  { value: 'giftcard_purchase', label: 'Gift card purchase' },
  { value: 'crypto_order', label: 'Crypto / USDT order' },
  { value: 'adjustment', label: 'Manual adjustment' },
  { value: 'other', label: 'Other' },
];

function formatMwk(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `MWK ${Math.round(n).toLocaleString()}`;
}

function formatPl(n: number | null | undefined): { text: string; positive: boolean | null } {
  if (n == null || !Number.isFinite(n)) return { text: '—', positive: null };
  const rounded = Math.round(n);
  return {
    text: `${rounded >= 0 ? '+' : ''}${rounded.toLocaleString()} MWK`,
    positive: rounded > 0 ? true : rounded < 0 ? false : null,
  };
}

function UsdtSnapshot({ snapshot }: { snapshot: InventorySnapshot | null }) {
  const pl = formatPl(snapshot?.realizedProfitLossMwk);
  return (
    <div className="card-dark p-5 rounded-xl border border-amber-500/30">
      <div className="flex items-center gap-2 mb-4">
        <Coins className="w-6 h-6 text-amber-400" />
        <h3 className="text-lg font-bold text-white">USDT inventory</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-gray-400 mb-1">Balance available</p>
          <p className="text-3xl font-bold text-neon-blue">
            {snapshot ? `${snapshot.balanceUsd.toFixed(2)} USDT` : '—'}
          </p>
        </div>
        <div>
          <p className="text-gray-400 mb-1">Avg buy rate</p>
          <p className="text-white font-semibold text-lg">
            {snapshot?.avgBuyRateMwk ? `${snapshot.avgBuyRateMwk.toLocaleString()} MWK/$` : '—'}
          </p>
        </div>
        <div>
          <p className="text-gray-400 mb-1">Stock value (cost)</p>
          <p className="text-white font-semibold text-lg">{formatMwk(snapshot?.totalCostBasisMwk)}</p>
        </div>
        <div>
          <p className="text-gray-400 mb-1">Total USDT added</p>
          <p className="text-green-300 font-semibold">{snapshot ? `${snapshot.totalInUsd.toFixed(2)} USDT` : '—'}</p>
        </div>
        <div>
          <p className="text-gray-400 mb-1">Total USDT used</p>
          <p className="text-amber-300 font-semibold">{snapshot ? `${snapshot.totalOutUsd.toFixed(2)} USDT` : '—'}</p>
        </div>
        <div>
          <p className="text-gray-400 mb-1">Realized profit / loss</p>
          <p
            className={`font-bold text-lg flex items-center gap-1 ${
              pl.positive === true ? 'text-green-400' : pl.positive === false ? 'text-red-400' : 'text-gray-300'
            }`}
          >
            {pl.positive === true && <TrendingUp className="w-4 h-4" />}
            {pl.positive === false && <TrendingDown className="w-4 h-4" />}
            {pl.text}
          </p>
        </div>
      </div>
    </div>
  );
}

function MwkSnapshotPanel({ snapshot }: { snapshot: MwkSnapshot | null }) {
  return (
    <div className="card-dark p-5 rounded-xl border border-green-500/30">
      <div className="flex items-center gap-2 mb-4">
        <Banknote className="w-6 h-6 text-green-400" />
        <h3 className="text-lg font-bold text-white">MWK tracking</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
        <div>
          <p className="text-gray-400 mb-1">Balance</p>
          <p className="text-3xl font-bold text-green-300">
            {snapshot ? formatMwk(snapshot.balanceMwk) : '—'}
          </p>
        </div>
        <div>
          <p className="text-gray-400 mb-1">Total MWK in</p>
          <p className="text-green-300 font-semibold text-lg">{formatMwk(snapshot?.totalInMwk)}</p>
        </div>
        <div>
          <p className="text-gray-400 mb-1">Total MWK out</p>
          <p className="text-red-300 font-semibold text-lg">{formatMwk(snapshot?.totalOutMwk)}</p>
        </div>
        <div>
          <p className="text-gray-400 mb-1">Net flow</p>
          <p className={`font-semibold text-lg ${(snapshot?.netFlowMwk ?? 0) >= 0 ? 'text-green-300' : 'text-red-300'}`}>
            {snapshot ? formatMwk(snapshot.netFlowMwk) : '—'}
          </p>
        </div>
      </div>
      {snapshot && snapshot.outByCategory.length > 0 && (
        <div className="pt-4 border-t border-dark-border">
          <p className="text-xs text-gray-400 uppercase mb-2">Expenses by category</p>
          <div className="flex flex-wrap gap-2">
            {snapshot.outByCategory.map((c) => (
              <span
                key={c.purpose}
                className="px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-200"
              >
                {c.label}: {c.totalMwk.toLocaleString()} MWK
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UsdtLedgerTable({ entries }: { entries: UsdtLedgerEntry[] }) {
  if (!entries.length) return <p className="text-gray-500 text-sm py-4">No USDT entries yet.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-dark-border">
      <table className="w-full text-sm text-left">
        <thead className="bg-dark-surface text-gray-400">
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">USDT</th>
            <th className="px-3 py-2">Buy rate</th>
            <th className="px-3 py-2">Sell rate</th>
            <th className="px-3 py-2">P/L</th>
            <th className="px-3 py-2">Balance</th>
            <th className="px-3 py-2">Purpose</th>
            <th className="px-3 py-2">Notes</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const pl = formatPl(e.profitLossMwk);
            return (
              <tr key={e.id} className="border-t border-dark-border text-gray-200">
                <td className="px-3 py-2 whitespace-nowrap">{new Date(e.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${e.direction === 'in' ? 'bg-green-500/20 text-green-300' : 'bg-amber-500/20 text-amber-300'}`}>
                    {e.direction === 'in' ? 'IN' : 'OUT'}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono">{e.quantityUsd.toFixed(2)}</td>
                <td className="px-3 py-2">{e.buyRateMwk?.toLocaleString() ?? '—'}</td>
                <td className="px-3 py-2">{e.sellRateMwk?.toLocaleString() ?? '—'}</td>
                <td className={`px-3 py-2 font-semibold ${pl.positive === true ? 'text-green-400' : pl.positive === false ? 'text-red-400' : ''}`}>{pl.text}</td>
                <td className="px-3 py-2 font-mono">{e.balanceAfterUsd != null ? `${e.balanceAfterUsd.toFixed(2)}` : '—'}</td>
                <td className="px-3 py-2 text-gray-400">{e.purpose || '—'}</td>
                <td className="px-3 py-2 text-gray-500 text-xs truncate max-w-[100px]">{e.notes || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MwkLedgerTable({ entries }: { entries: MwkLedgerEntry[] }) {
  if (!entries.length) return <p className="text-gray-500 text-sm py-4">No MWK entries yet.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-dark-border">
      <table className="w-full text-sm text-left">
        <thead className="bg-dark-surface text-gray-400">
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Amount</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">Balance</th>
            <th className="px-3 py-2">Reference</th>
            <th className="px-3 py-2">Notes</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-t border-dark-border text-gray-200">
              <td className="px-3 py-2 whitespace-nowrap">{new Date(e.createdAt).toLocaleString()}</td>
              <td className="px-3 py-2">
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${e.direction === 'in' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                  {e.direction === 'in' ? 'IN' : 'OUT'}
                </span>
              </td>
              <td className="px-3 py-2 font-mono">{e.quantityMwk?.toLocaleString() ?? '—'} MWK</td>
              <td className="px-3 py-2">{e.purposeLabel || mwkPurposeLabel(e.purpose)}</td>
              <td className="px-3 py-2 font-mono">{e.balanceAfterMwk != null ? `${e.balanceAfterMwk.toLocaleString()} MWK` : '—'}</td>
              <td className="px-3 py-2 text-gray-400 text-xs">{e.reference || '—'}</td>
              <td className="px-3 py-2 text-gray-500 text-xs truncate max-w-[120px]">{e.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const AdminDashboard: React.FC = () => {
  const [adminPass, setAdminPass] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'usdt' | 'mwk'>('usdt');

  const [usdtSummary, setUsdtSummary] = useState<InventorySnapshot | null>(null);
  const [mwkSummary, setMwkSummary] = useState<MwkSnapshot | null>(null);
  const [usdtEntries, setUsdtEntries] = useState<UsdtLedgerEntry[]>([]);
  const [mwkEntries, setMwkEntries] = useState<MwkLedgerEntry[]>([]);

  const [usdtIn, setUsdtIn] = useState({ quantityUsd: '', buyRateMwk: '', notes: '' });
  const [usdtOut, setUsdtOut] = useState({ quantityUsd: '', sellRateMwk: '', purpose: 'virtual_card', notes: '', reference: '' });
  const [mwkIn, setMwkIn] = useState({ amountMwk: '', purpose: 'sales_revenue', notes: '', reference: '' });
  const [mwkOut, setMwkOut] = useState({ amountMwk: '', purpose: 'expense', notes: '', reference: '' });

  const headers = useCallback(() => getAdminAuthHeaders(isAuthenticated) as HeadersInit, [isAuthenticated]);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError('');
    try {
      const [summaryRes, usdtRes, mwkRes] = await Promise.all([
        fetch(`${getApiBase()}/inventory/summary`, { headers: headers() }),
        fetch(`${getApiBase()}/inventory/ledger?assetType=usdt&limit=500`, { headers: headers() }),
        fetch(`${getApiBase()}/inventory/ledger?assetType=mwk&limit=500`, { headers: headers() }),
      ]);
      const summary = await readResponseJson<{ usdt?: InventorySnapshot; mwk?: MwkSnapshot; error?: string }>(summaryRes);
      const usdtData = await readResponseJson<{ entries?: UsdtLedgerEntry[]; error?: string }>(usdtRes);
      const mwkData = await readResponseJson<{ entries?: MwkLedgerEntry[]; error?: string }>(mwkRes);
      if (!summaryRes.ok) throw new Error(summary.error || 'Failed to load summary');
      if (!usdtRes.ok) throw new Error(usdtData.error || 'Failed to load USDT ledger');
      if (!mwkRes.ok) throw new Error(mwkData.error || 'Failed to load MWK ledger');
      setUsdtSummary(summary.usdt ?? null);
      setMwkSummary(summary.mwk ?? null);
      setUsdtEntries(Array.isArray(usdtData.entries) ? usdtData.entries : []);
      setMwkEntries(Array.isArray(mwkData.entries) ? mwkData.entries : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, headers]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPass === ADMIN_PASSWORD) { setIsAuthenticated(true); setError(''); }
    else setError('Invalid password');
  };

  const postEntry = async (path: string, body: Record<string, unknown>, showPl = false) => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${getApiBase()}/inventory/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers() },
        body: JSON.stringify(body),
      });
      const data = await readResponseJson<{ error?: string; profitLossMwk?: number }>(res);
      if (!res.ok) throw new Error(data.error || 'Request failed');
      await loadData();
      if (showPl && typeof data.profitLossMwk === 'number') {
        alert(`Recorded. P/L: ${formatPl(data.profitLossMwk).text}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save';
      setError(msg);
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const asset = activeTab;
      const res = await fetch(`${getApiBase()}/inventory/ledger?assetType=${asset}&limit=500`, { headers: headers() });
      const data = await readResponseJson<{ entries?: unknown[]; snapshot?: unknown; error?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Export failed');
      if (activeTab === 'usdt') {
        downloadUsdtInventoryExcel(usdtSummary, (data.entries as UsdtLedgerEntry[]) || usdtEntries);
      } else {
        downloadMwkInventoryExcel(mwkSummary, (data.entries as MwkLedgerEntry[]) || mwkEntries);
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center px-4">
        <div className="card-dark p-8 rounded-2xl max-w-md w-full border border-neon-blue/30">
          <h1 className="text-2xl font-bold text-white mb-1">TConnect Dashboard</h1>
          <p className="text-gray-400 text-sm mb-6">USDT inventory & MWK tracking · /admin/dashboard</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} placeholder="Admin password" className="w-full px-4 py-3 bg-dark-surface border border-dark-border rounded-lg text-white" autoFocus />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" className="w-full py-3 rounded-lg bg-neon-blue text-white font-semibold">Access Dashboard</button>
          </form>
          <p className="text-gray-500 text-xs mt-4 text-center"><Link to="/admin" className="text-neon-blue hover:underline">Main admin panel</Link></p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <Link to="/admin" className="text-gray-400 hover:text-neon-blue"><ArrowLeft className="w-5 h-5" /></Link>
            <div>
              <h1 className="text-2xl font-bold text-white">TConnect Dashboard</h1>
              <p className="text-gray-400 text-sm">USDT inventory & MWK expense tracking</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleExportExcel} disabled={exporting || loading} className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
              <Download className="w-4 h-4" />{exporting ? 'Exporting…' : 'Download Excel'}
            </button>
            <button type="button" onClick={() => loadData()} disabled={loading} className="px-4 py-2 rounded-lg border border-dark-border text-gray-300 text-sm">{loading ? '…' : 'Refresh'}</button>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <button type="button" onClick={() => setActiveTab('usdt')} className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 ${activeTab === 'usdt' ? 'bg-amber-500/20 text-amber-200 border border-amber-400/40' : 'bg-dark-surface text-gray-400'}`}>
            <Coins className="w-4 h-4" /> USDT
          </button>
          <button type="button" onClick={() => setActiveTab('mwk')} className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 ${activeTab === 'mwk' ? 'bg-green-500/20 text-green-200 border border-green-400/40' : 'bg-dark-surface text-gray-400'}`}>
            <Banknote className="w-4 h-4" /> MWK
          </button>
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>}

        {loading && !usdtSummary && !mwkSummary ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
        ) : activeTab === 'usdt' ? (
          <div className="space-y-6">
            <UsdtSnapshot snapshot={usdtSummary} />
            <div className="grid md:grid-cols-2 gap-4">
              <div className="card-dark p-5 rounded-xl border border-green-500/30">
                <h3 className="text-white font-bold mb-3 flex items-center gap-2"><ArrowDownCircle className="w-5 h-5 text-green-400" /> Add USDT</h3>
                <div className="space-y-3">
                  <input type="number" step="0.01" placeholder="Amount USDT *" value={usdtIn.quantityUsd} onChange={(e) => setUsdtIn((p) => ({ ...p, quantityUsd: e.target.value }))} className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" />
                  <input type="number" step="1" placeholder="Buy rate MWK per $1 *" value={usdtIn.buyRateMwk} onChange={(e) => setUsdtIn((p) => ({ ...p, buyRateMwk: e.target.value }))} className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" />
                  <input placeholder="Notes" value={usdtIn.notes} onChange={(e) => setUsdtIn((p) => ({ ...p, notes: e.target.value }))} className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" />
                  <button type="button" disabled={submitting} onClick={() => postEntry('usdt/in', { quantityUsd: Number(usdtIn.quantityUsd), buyRateMwk: Number(usdtIn.buyRateMwk), notes: usdtIn.notes }).then(() => setUsdtIn({ quantityUsd: '', buyRateMwk: '', notes: '' }))} className="w-full py-2.5 rounded-lg bg-green-600 text-white font-semibold disabled:opacity-50">Add USDT</button>
                </div>
              </div>
              <div className="card-dark p-5 rounded-xl border border-amber-500/30">
                <h3 className="text-white font-bold mb-3 flex items-center gap-2"><ArrowUpCircle className="w-5 h-5 text-amber-400" /> Use / sell USDT</h3>
                <div className="space-y-3">
                  <input type="number" step="0.01" placeholder="Amount USDT *" value={usdtOut.quantityUsd} onChange={(e) => setUsdtOut((p) => ({ ...p, quantityUsd: e.target.value }))} className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" />
                  <input type="number" step="1" placeholder="Sell rate MWK per $1 *" value={usdtOut.sellRateMwk} onChange={(e) => setUsdtOut((p) => ({ ...p, sellRateMwk: e.target.value }))} className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" />
                  <select value={usdtOut.purpose} onChange={(e) => setUsdtOut((p) => ({ ...p, purpose: e.target.value }))} className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white">
                    {USDT_OUT_PURPOSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input placeholder="Order ref" value={usdtOut.reference} onChange={(e) => setUsdtOut((p) => ({ ...p, reference: e.target.value }))} className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" />
                  <input placeholder="Notes" value={usdtOut.notes} onChange={(e) => setUsdtOut((p) => ({ ...p, notes: e.target.value }))} className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" />
                  <button type="button" disabled={submitting} onClick={() => postEntry('usdt/out', { quantityUsd: Number(usdtOut.quantityUsd), sellRateMwk: Number(usdtOut.sellRateMwk), purpose: usdtOut.purpose, notes: usdtOut.notes, reference: usdtOut.reference }, true).then(() => setUsdtOut({ quantityUsd: '', sellRateMwk: '', purpose: 'virtual_card', notes: '', reference: '' }))} className="w-full py-2.5 rounded-lg bg-amber-600 text-white font-semibold disabled:opacity-50">Record usage</button>
                </div>
              </div>
            </div>
            <div className="card-dark p-5 rounded-xl">
              <h3 className="text-white font-bold mb-4">USDT ledger</h3>
              <UsdtLedgerTable entries={usdtEntries} />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <MwkSnapshotPanel snapshot={mwkSummary} />
            <div className="grid md:grid-cols-2 gap-4">
              <div className="card-dark p-5 rounded-xl border border-green-500/30">
                <h3 className="text-white font-bold mb-3 flex items-center gap-2"><ArrowDownCircle className="w-5 h-5 text-green-400" /> MWK in (income)</h3>
                <p className="text-gray-400 text-xs mb-3">Sales, mobile money received, bank deposits, etc.</p>
                <div className="space-y-3">
                  <input type="number" step="1" placeholder="Amount MWK *" value={mwkIn.amountMwk} onChange={(e) => setMwkIn((p) => ({ ...p, amountMwk: e.target.value }))} className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" />
                  <select value={mwkIn.purpose} onChange={(e) => setMwkIn((p) => ({ ...p, purpose: e.target.value }))} className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white">
                    {MWK_IN_PURPOSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input placeholder="Reference (order #, etc.)" value={mwkIn.reference} onChange={(e) => setMwkIn((p) => ({ ...p, reference: e.target.value }))} className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" />
                  <input placeholder="Notes" value={mwkIn.notes} onChange={(e) => setMwkIn((p) => ({ ...p, notes: e.target.value }))} className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" />
                  <button type="button" disabled={submitting} onClick={() => postEntry('mwk/in', { amountMwk: Number(mwkIn.amountMwk), purpose: mwkIn.purpose, notes: mwkIn.notes, reference: mwkIn.reference }).then(() => setMwkIn({ amountMwk: '', purpose: 'sales_revenue', notes: '', reference: '' }))} className="w-full py-2.5 rounded-lg bg-green-600 text-white font-semibold disabled:opacity-50">Record MWK in</button>
                </div>
              </div>
              <div className="card-dark p-5 rounded-xl border border-red-500/30">
                <h3 className="text-white font-bold mb-3 flex items-center gap-2"><ArrowUpCircle className="w-5 h-5 text-red-400" /> MWK out (expense)</h3>
                <p className="text-gray-400 text-xs mb-3">Giveaways, spin wins, bonuses, points, promos, bills, etc.</p>
                <div className="space-y-3">
                  <input type="number" step="1" placeholder="Amount MWK *" value={mwkOut.amountMwk} onChange={(e) => setMwkOut((p) => ({ ...p, amountMwk: e.target.value }))} className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" />
                  <select value={mwkOut.purpose} onChange={(e) => setMwkOut((p) => ({ ...p, purpose: e.target.value }))} className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white">
                    {MWK_OUT_PURPOSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input placeholder="Reference (user, order #)" value={mwkOut.reference} onChange={(e) => setMwkOut((p) => ({ ...p, reference: e.target.value }))} className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" />
                  <input placeholder="Notes" value={mwkOut.notes} onChange={(e) => setMwkOut((p) => ({ ...p, notes: e.target.value }))} className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" />
                  <button type="button" disabled={submitting} onClick={() => postEntry('mwk/out', { amountMwk: Number(mwkOut.amountMwk), purpose: mwkOut.purpose, notes: mwkOut.notes, reference: mwkOut.reference }).then(() => setMwkOut({ amountMwk: '', purpose: 'expense', notes: '', reference: '' }))} className="w-full py-2.5 rounded-lg bg-red-600 text-white font-semibold disabled:opacity-50">Record expense</button>
                </div>
              </div>
            </div>
            <div className="card-dark p-5 rounded-xl">
              <h3 className="text-white font-bold mb-4">MWK ledger</h3>
              <MwkLedgerTable entries={mwkEntries} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
