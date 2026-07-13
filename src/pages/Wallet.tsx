import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Smartphone, Wallet as WalletIcon, ArrowLeft, Plus, History } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getApiBase } from '../lib/getApiBase';
import { readResponseJson } from '../lib/parseResponseJson';
import { PAWAPAY_CHECKOUT_ENABLED } from '../lib/checkoutFlags';
import { getMwkAmountFromUsd } from '../utils/rates';
import { WALLET_TOPUP_MAX_USD, WALLET_TOPUP_MIN_USD } from '../lib/storeWallet';

type WalletTransaction = {
  id: string;
  type: string;
  amountUsd: number;
  description?: string | null;
  createdAt: string;
};

const PRESET_TOPUP_USD = [5, 10, 20, 50, 100];

const WalletPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [balanceUsd, setBalanceUsd] = useState(0);
  const [balanceMwk, setBalanceMwk] = useState(0);
  const [walletRate, setWalletRate] = useState(1850);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [topUpAmountUsd, setTopUpAmountUsd] = useState('10');
  const [topUpBusy, setTopUpBusy] = useState(false);
  const [pawapayEnabled, setPawapayEnabled] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const topUpMwkEstimate = useMemo(() => {
    const usd = Number(topUpAmountUsd);
    if (!Number.isFinite(usd) || usd <= 0 || walletRate <= 0) return 0;
    return Math.max(1, Math.round(usd * walletRate));
  }, [topUpAmountUsd, walletRate]);

  const loadWallet = useCallback(async () => {
    if (!user?.email) {
      setBalanceUsd(0);
      setBalanceMwk(0);
      setTransactions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/wallet?email=${encodeURIComponent(user.email)}`);
      const data = await readResponseJson(res);
      if (!res.ok) throw new Error((data as { error?: string })?.error || 'Failed to load wallet');
      const usd = Number((data as { balanceUsd?: number }).balanceUsd || 0);
      setBalanceUsd(usd);
      setBalanceMwk(Number((data as { balanceMwk?: number }).balanceMwk ?? getMwkAmountFromUsd(usd, 'store_wallet')));
      const rate = Number((data as { walletRateMwkPerUsd?: number }).walletRateMwkPerUsd || 1850);
      setWalletRate(rate);
      setTransactions(Array.isArray((data as { transactions?: unknown }).transactions) ? (data as { transactions: WalletTransaction[] }).transactions : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load wallet');
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  useEffect(() => {
    if (!PAWAPAY_CHECKOUT_ENABLED) return;
    fetch(`${getApiBase()}/payments/pawapay/status`)
      .then((r) => r.json())
      .then((d) => setPawapayEnabled(Boolean(d?.enabled)))
      .catch(() => setPawapayEnabled(false));
  }, []);

  useEffect(() => {
    const depositId = new URLSearchParams(location.search).get('depositId')?.trim();
    if (!depositId || !user?.email) return;

    let cancelled = false;
    (async () => {
      setMessage('Confirming your mobile money payment…');
      try {
        const res = await fetch(
          `${getApiBase()}/wallet/topup/verify?depositId=${encodeURIComponent(depositId)}`
        );
        const data = await readResponseJson<{ ok?: boolean; error?: string; walletCreditedUsd?: number }>(res);
        if (!res.ok || !data.ok) throw new Error(data.error || 'Payment could not be verified');
        if (cancelled) return;
        const creditedUsd = Number(data.walletCreditedUsd || 0);
        setMessage(
          creditedUsd
            ? `$${creditedUsd.toFixed(2)} added to your Wallet.`
            : 'Wallet topped up successfully.'
        );
        window.history.replaceState({}, '', '/wallet');
        window.dispatchEvent(new Event('tconnect-wallet-updated'));
        await loadWallet();
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Verification failed');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.search, user?.email, loadWallet]);

  const startTopUp = async () => {
    if (!user?.email) {
      alert('Sign in to use your Wallet.');
      return;
    }
    const amountUsd = Number(topUpAmountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd < WALLET_TOPUP_MIN_USD) {
      alert(`Minimum top-up is $${WALLET_TOPUP_MIN_USD}.`);
      return;
    }
    if (amountUsd > WALLET_TOPUP_MAX_USD) {
      alert(`Maximum top-up is $${WALLET_TOPUP_MAX_USD}.`);
      return;
    }
    setTopUpBusy(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBase()}/wallet/topup/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, amountUsd }),
      });
      const data = await readResponseJson<{ redirectUrl?: string; error?: string }>(res);
      if (!res.ok || !data.redirectUrl) throw new Error(data.error || 'Could not start payment');
      window.location.href = data.redirectUrl;
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Top-up failed');
    } finally {
      setTopUpBusy(false);
    }
  };

  if (!user?.email) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="card-dark p-6 rounded-xl border border-dark-border text-center">
          <WalletIcon className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Wallet</h1>
          <p className="text-gray-400 mb-4">Sign in to add money and pay at checkout.</p>
          <Link to="/signin" className="text-neon-blue font-semibold hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 text-sm">
        <ArrowLeft className="w-4 h-4" />
        Back to store
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <WalletIcon className="w-10 h-10 text-amber-400" />
        <div>
          <h1 className="text-3xl font-bold text-white">Wallet</h1>
          <p className="text-gray-400 text-sm">Pay at checkout with your balance</p>
        </div>
      </div>

      <div className="card-dark p-6 rounded-xl border border-amber-500/30 bg-amber-500/5 mb-6">
        <p className="text-sm text-gray-400 mb-1">Available balance</p>
        <p className="text-4xl font-bold text-amber-300">${balanceUsd.toFixed(2)}</p>
        <p className="text-sm text-gray-400 mt-2">≈ MWK {balanceMwk.toLocaleString()}</p>
      </div>

      {message && <p className="text-green-400 text-sm mb-4 text-center">{message}</p>}
      {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}

      <div className="card-dark p-6 rounded-xl border border-dark-border mb-6">
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Plus className="w-5 h-5 text-green-400" />
          Add money
        </h2>
        {!pawapayEnabled ? (
          <p className="text-sm text-amber-300/90">Mobile money top-up is unavailable right now. Please try again later or use another payment method at checkout.</p>
        ) : (
          <>
            <p className="text-sm text-gray-400 mb-3">
              Add funds with Airtel or TNM mobile money. Amount: ${WALLET_TOPUP_MIN_USD}–${WALLET_TOPUP_MAX_USD} per top-up.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESET_TOPUP_USD.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setTopUpAmountUsd(String(a))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${
                    topUpAmountUsd === String(a)
                      ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                      : 'border-dark-border text-gray-300 hover:border-amber-500/50'
                  }`}
                >
                  ${a}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  min={WALLET_TOPUP_MIN_USD}
                  max={WALLET_TOPUP_MAX_USD}
                  step={0.01}
                  value={topUpAmountUsd}
                  onChange={(e) => setTopUpAmountUsd(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-dark-bg border border-dark-border text-white"
                />
              </div>
              <button
                type="button"
                disabled={topUpBusy}
                onClick={startTopUp}
                className="px-5 py-2.5 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-500 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Smartphone className="w-5 h-5" />
                {topUpBusy ? 'Opening…' : 'Add with mobile money'}
              </button>
            </div>
            {topUpMwkEstimate > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                Pay MWK {topUpMwkEstimate.toLocaleString()} on your phone · ${Number(topUpAmountUsd || 0).toFixed(2)} credited to Wallet
              </p>
            )}
          </>
        )}
      </div>

      <div className="card-dark p-6 rounded-xl border border-dark-border">
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <History className="w-5 h-5 text-gray-400" />
          Activity
        </h2>
        {loading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : transactions.length === 0 ? (
          <p className="text-gray-500 text-sm">No activity yet.</p>
        ) : (
          <ul className="divide-y divide-dark-border">
            {transactions.map((tx) => {
              const mwk = getMwkAmountFromUsd(Math.abs(tx.amountUsd), 'store_wallet');
              const sign = tx.amountUsd >= 0 ? '+' : '−';
              return (
                <li key={tx.id} className="py-3 flex justify-between gap-3 text-sm">
                  <div>
                    <p className="text-gray-200">{tx.description || tx.type}</p>
                    <p className="text-xs text-gray-500">{new Date(tx.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <span className={tx.amountUsd >= 0 ? 'text-green-400 font-semibold block' : 'text-red-400 font-semibold block'}>
                      {sign}MWK {mwk.toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-500">
                      {sign}${Math.abs(tx.amountUsd).toFixed(2)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-center text-sm text-gray-500 mt-6">
        <Link to="/checkout" className="text-neon-blue hover:underline">
          Go to checkout
        </Link>{' '}
        to pay with your Wallet balance.
      </p>
    </div>
  );
};

export default WalletPage;
