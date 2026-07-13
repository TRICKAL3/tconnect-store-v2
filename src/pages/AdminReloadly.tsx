import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Gift,
  Loader2,
  RefreshCw,
  Smartphone,
  Wifi,
} from 'lucide-react';
import { getApiBase } from '../lib/getApiBase';
import { readResponseJson } from '../lib/parseResponseJson';
import { ADMIN_PASSWORD, getAdminAuthHeaders } from '../lib/adminAuth';

type Tab = 'status' | 'giftcards' | 'airtime';

type StatusPayload = {
  configured: boolean;
  sandbox: boolean;
  clientIdHint?: string;
  giftcards?: { ok: boolean; balance?: { balance?: number; currencyCode?: string }; error?: string };
  airtime?: { ok: boolean; balance?: { balance?: number; currencyCode?: string }; error?: string };
};

type GiftProduct = {
  productId: number;
  productName: string;
  minRecipientDenomination?: number;
  maxRecipientDenomination?: number;
  recipientCurrencyCode?: string;
  denominationType?: string;
};

type Operator = {
  operatorId?: number;
  id?: number;
  name?: string;
  minAmount?: number;
  maxAmount?: number;
  fx?: { rate?: number; currencyCode?: string };
};

export default function AdminReloadly() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('status');
  const [status, setStatus] = useState<StatusPayload | null>(null);

  const [giftCountry, setGiftCountry] = useState('US');
  const [giftProducts, setGiftProducts] = useState<GiftProduct[]>([]);
  const [giftForm, setGiftForm] = useState({
    productId: '',
    unitPrice: '5',
    recipientEmail: '',
    senderName: 'TConnect Store',
  });
  const [giftResult, setGiftResult] = useState<unknown>(null);

  const [airtimeCountry, setAirtimeCountry] = useState('MW');
  const [operators, setOperators] = useState<Operator[]>([]);
  const [airtimeForm, setAirtimeForm] = useState({
    operatorId: '',
    amount: '500',
    phoneNumber: '',
  });
  const [airtimeResult, setAirtimeResult] = useState<unknown>(null);

  const headers = useCallback(
    () => ({
      'Content-Type': 'application/json',
      ...getAdminAuthHeaders(isAuthenticated),
    }),
    [isAuthenticated]
  );

  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(`${getApiBase()}/reloadly${path}`, {
        ...init,
        headers: { ...headers(), ...(init?.headers as Record<string, string>) },
      });
      const data = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      return data;
    },
    [headers]
  );

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api('/status');
      setStatus(data as StatusPayload);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (isAuthenticated && tab === 'status') loadStatus();
  }, [isAuthenticated, tab, loadStatus]);

  const loadGiftProducts = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api(`/gift-cards/products?country=${giftCountry}&size=40`);
      setGiftProducts((data as { products?: GiftProduct[] }).products ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const loadOperators = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api(`/airtime/operators?country=${airtimeCountry}`);
      setOperators((data as { operators?: Operator[] }).operators ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const submitGiftOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setGiftResult(null);
    try {
      const data = await api('/gift-cards/order', {
        method: 'POST',
        body: JSON.stringify({
          productId: Number(giftForm.productId),
          unitPrice: Number(giftForm.unitPrice),
          countryCode: giftCountry,
          quantity: 1,
          recipientEmail: giftForm.recipientEmail,
          senderName: giftForm.senderName,
        }),
      });
      setGiftResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Order failed');
    } finally {
      setLoading(false);
    }
  };

  const submitAirtime = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setAirtimeResult(null);
    try {
      const data = await api('/airtime/topup', {
        method: 'POST',
        body: JSON.stringify({
          operatorId: airtimeForm.operatorId,
          amount: airtimeForm.amount,
          countryCode: airtimeCountry,
          phoneNumber: airtimeForm.phoneNumber,
          useLocalAmount: true,
        }),
      });
      setAirtimeResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Top-up failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPass === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Invalid password');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center px-4">
        <div className="card-dark p-8 rounded-2xl max-w-md w-full border border-cyan-500/30">
          <h1 className="text-2xl font-bold text-white mb-1">Reloadly Integration</h1>
          <p className="text-gray-400 text-sm mb-6">Admin test console · sandbox first</p>
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
            <button type="submit" className="w-full py-3 rounded-lg bg-cyan-600 text-white font-semibold">
              Enter
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
            <Link to="/admin" className="text-gray-400 hover:text-cyan-400">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Reloadly Test Console</h1>
              <p className="text-gray-400 text-sm">
                Gift cards · airtime ·{' '}
                <a href="https://developers.reloadly.com/" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">
                  docs
                </a>
              </p>
            </div>
          </div>
          {status && (
            <span className={`text-xs px-3 py-1 rounded-full border ${status.sandbox ? 'border-yellow-500/40 text-yellow-300 bg-yellow-500/10' : 'border-green-500/40 text-green-300 bg-green-500/10'}`}>
              {status.sandbox ? 'Sandbox' : 'Live'}
            </span>
          )}
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {([
            { id: 'status' as Tab, label: 'Connection', icon: Wifi },
            { id: 'giftcards' as Tab, label: 'Gift cards', icon: Gift },
            { id: 'airtime' as Tab, label: 'Airtime', icon: Smartphone },
          ]).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${
                  tab === t.id ? 'bg-cyan-600 text-white' : 'bg-dark-surface text-gray-400 border border-dark-border'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>
        )}

        {tab === 'status' && (
          <div className="card-dark p-6 rounded-xl space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-white">API status</h2>
              <button type="button" onClick={loadStatus} disabled={loading} className="text-sm text-cyan-400 flex items-center gap-1">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
            {!status && loading ? (
              <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
            ) : status ? (
              <>
                <p className="text-sm text-gray-400">
                  Configured: <span className={status.configured ? 'text-green-400' : 'text-red-400'}>{status.configured ? 'Yes' : 'No'}</span>
                  {status.clientIdHint && (
                    <span className="text-gray-500"> · Client ID {status.clientIdHint}</span>
                  )}
                </p>
                {!status.configured && (
                  <div className="text-sm text-gray-300 bg-dark-surface p-4 rounded-lg border border-dark-border">
                    Add to Vercel env (sandbox credentials from Reloadly → Developers → API Settings):
                    <pre className="mt-2 text-xs text-cyan-300 overflow-x-auto">{`RELOADLY_CLIENT_ID=...\nRELOADLY_CLIENT_SECRET=...\nRELOADLY_SANDBOX=true`}</pre>
                  </div>
                )}
                {(status.giftcards?.error || status.airtime?.error) && (
                  <div className="text-sm text-amber-200 bg-amber-500/10 p-4 rounded-lg border border-amber-500/30 space-y-2">
                    <p className="font-semibold text-amber-100">Access Denied — how to fix</p>
                    <ol className="list-decimal list-inside text-xs space-y-1 text-amber-100/90">
                      <li>Open <a href="https://portal.reloadly.com/" target="_blank" rel="noreferrer" className="text-cyan-400 underline">Reloadly portal</a> → Developers → API Settings</li>
                      <li>Toggle <strong>Sandbox</strong> (for testing) or <strong>Live</strong> (production)</li>
                      <li>Copy the matching Client ID + Client Secret (sandbox and live are different)</li>
                      <li>In Vercel → Project → Settings → Environment Variables, update all three vars and redeploy</li>
                    </ol>
                    <p className="text-xs text-amber-200/80">
                      Sandbox credentials require <code className="text-cyan-300">RELOADLY_SANDBOX=true</code>.
                      Live credentials require <code className="text-cyan-300">RELOADLY_SANDBOX=false</code>.
                      Mixing them causes access_denied.
                    </p>
                  </div>
                )}
                {status.giftcards && (
                  <div className="p-4 rounded-lg border border-dark-border bg-dark-surface/50">
                    <p className="text-white font-semibold mb-1">Gift cards wallet</p>
                    {status.giftcards.ok ? (
                      <p className="text-green-300 text-sm">
                        {status.giftcards.balance?.currencyCode} {status.giftcards.balance?.balance}
                      </p>
                    ) : (
                      <p className="text-red-300 text-sm">{status.giftcards.error}</p>
                    )}
                  </div>
                )}
                {status.airtime && (
                  <div className="p-4 rounded-lg border border-dark-border bg-dark-surface/50">
                    <p className="text-white font-semibold mb-1">Airtime wallet</p>
                    {status.airtime.ok ? (
                      <p className="text-green-300 text-sm">
                        {status.airtime.balance?.currencyCode} {status.airtime.balance?.balance}
                      </p>
                    ) : (
                      <p className="text-red-300 text-sm">{status.airtime.error}</p>
                    )}
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {tab === 'giftcards' && (
          <div className="space-y-4">
            <div className="card-dark p-5 rounded-xl flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Country ISO</label>
                <input
                  value={giftCountry}
                  onChange={(e) => setGiftCountry(e.target.value.toUpperCase())}
                  className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white w-24"
                />
              </div>
              <button type="button" onClick={loadGiftProducts} disabled={loading} className="px-4 py-2 rounded-lg bg-cyan-700 text-white text-sm font-semibold">
                Load products
              </button>
            </div>

            {giftProducts.length > 0 && (
              <div className="card-dark p-5 rounded-xl max-h-64 overflow-y-auto">
                <p className="text-xs text-gray-500 mb-3">{giftProducts.length} products</p>
                <div className="space-y-2">
                  {giftProducts.map((p) => (
                    <button
                      key={p.productId}
                      type="button"
                      onClick={() => setGiftForm((f) => ({
                        ...f,
                        productId: String(p.productId),
                        unitPrice: String(p.minRecipientDenomination ?? 5),
                      }))}
                      className={`w-full text-left p-3 rounded-lg border text-sm ${
                        giftForm.productId === String(p.productId)
                          ? 'border-cyan-500 bg-cyan-500/10 text-white'
                          : 'border-dark-border text-gray-300 hover:border-cyan-500/40'
                      }`}
                    >
                      <span className="font-semibold">{p.productName}</span>
                      <span className="text-gray-500 ml-2">#{p.productId}</span>
                      {p.minRecipientDenomination != null && (
                        <span className="block text-xs text-gray-500 mt-1">
                          {p.recipientCurrencyCode} {p.minRecipientDenomination}–{p.maxRecipientDenomination}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={submitGiftOrder} className="card-dark p-5 rounded-xl space-y-3">
              <h3 className="font-bold text-white">Test gift card order</h3>
              <p className="text-xs text-yellow-400">Uses sandbox wallet — real codes in sandbox mode.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <input required placeholder="Product ID" value={giftForm.productId} onChange={(e) => setGiftForm((f) => ({ ...f, productId: e.target.value }))} className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm" />
                <input required type="number" step="0.01" placeholder="Unit price USD" value={giftForm.unitPrice} onChange={(e) => setGiftForm((f) => ({ ...f, unitPrice: e.target.value }))} className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm" />
                <input required type="email" placeholder="Recipient email" value={giftForm.recipientEmail} onChange={(e) => setGiftForm((f) => ({ ...f, recipientEmail: e.target.value }))} className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm sm:col-span-2" />
              </div>
              <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg bg-cyan-600 text-white font-semibold disabled:opacity-50">
                {loading ? 'Ordering…' : 'Place test order'}
              </button>
            </form>

            {giftResult != null && (
              <pre className="card-dark p-4 rounded-xl text-xs text-green-300 overflow-x-auto border border-green-500/20">
                {JSON.stringify(giftResult, null, 2)}
              </pre>
            )}
          </div>
        )}

        {tab === 'airtime' && (
          <div className="space-y-4">
            <div className="card-dark p-5 rounded-xl flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Country ISO</label>
                <input
                  value={airtimeCountry}
                  onChange={(e) => setAirtimeCountry(e.target.value.toUpperCase())}
                  className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white w-24"
                />
              </div>
              <button type="button" onClick={loadOperators} disabled={loading} className="px-4 py-2 rounded-lg bg-cyan-700 text-white text-sm font-semibold">
                Load operators
              </button>
            </div>

            {operators.length > 0 && (
              <div className="card-dark p-5 rounded-xl max-h-48 overflow-y-auto space-y-2">
                {operators.map((op) => {
                  const id = op.operatorId ?? op.id;
                  return (
                    <button
                      key={String(id)}
                      type="button"
                      onClick={() => setAirtimeForm((f) => ({ ...f, operatorId: String(id) }))}
                      className={`w-full text-left p-3 rounded-lg border text-sm ${
                        airtimeForm.operatorId === String(id)
                          ? 'border-cyan-500 bg-cyan-500/10 text-white'
                          : 'border-dark-border text-gray-300'
                      }`}
                    >
                      {op.name} <span className="text-gray-500">ID {id}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <form onSubmit={submitAirtime} className="card-dark p-5 rounded-xl space-y-3">
              <h3 className="font-bold text-white">Test airtime top-up</h3>
              <p className="text-xs text-yellow-400">MW = Malawi (Airtel/TNM). Sandbox uses test numbers per Reloadly docs.</p>
              <input required placeholder="Operator ID" value={airtimeForm.operatorId} onChange={(e) => setAirtimeForm((f) => ({ ...f, operatorId: e.target.value }))} className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm" />
              <input required placeholder="Amount (local currency if useLocalAmount)" value={airtimeForm.amount} onChange={(e) => setAirtimeForm((f) => ({ ...f, amount: e.target.value }))} className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm" />
              <input required placeholder="Phone number (no country code)" value={airtimeForm.phoneNumber} onChange={(e) => setAirtimeForm((f) => ({ ...f, phoneNumber: e.target.value }))} className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm" />
              <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg bg-cyan-600 text-white font-semibold disabled:opacity-50">
                {loading ? 'Sending…' : 'Send test top-up'}
              </button>
            </form>

            {airtimeResult != null && (
              <pre className="card-dark p-4 rounded-xl text-xs text-green-300 overflow-x-auto border border-green-500/20">
                {JSON.stringify(airtimeResult, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
