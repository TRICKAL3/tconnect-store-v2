import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { getApiBase } from '../lib/getApiBase';
import { getMwkAmountFromUsd } from '../utils/rates';

const API_BASE = getApiBase();

interface Rate {
  id: string;
  type: 'giftcard' | 'crypto' | 'wallet' | 'store_wallet';
  value: number;
  createdAt: string;
}

interface RateChartData {
  date: string;
  giftcard: number | null;
  crypto: number | null;
  wallet: number | null;
  store_wallet: number | null;
}

const Rates: React.FC = () => {
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentRates, setCurrentRates] = useState<Record<string, number>>({
    giftcard: 1900,
    crypto: 1800,
    wallet: 1850,
    store_wallet: 1700,
  });

  useEffect(() => {
    loadRates();
  }, []);

  const loadRates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/rates`);
      if (res.ok) {
        const data = await res.json();
        setRates(data);
        
        // Calculate current rates (latest for each type)
        const latest: Record<string, number> = {};
        const latestDates: Record<string, string> = {};
        data.forEach((rate: Rate) => {
          if (!latest[rate.type] || new Date(rate.createdAt) > new Date(latestDates[rate.type] || 0)) {
            latest[rate.type] = rate.value;
            latestDates[rate.type] = rate.createdAt;
          }
        });
        setCurrentRates({
          giftcard: latest.giftcard || 1900,
          crypto: latest.crypto || 1800,
          wallet: latest.wallet || 1850,
          store_wallet: latest.store_wallet || latest.wallet || 1700,
        });
      }
    } catch (error) {
      console.error('Failed to load rates:', error);
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data
  const prepareChartData = (): RateChartData[] => {
    // Group rates by date
    const dateMap: Record<string, { giftcard?: number; crypto?: number; wallet?: number; store_wallet?: number }> = {};
    
    rates.forEach(rate => {
      const date = new Date(rate.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!dateMap[date]) {
        dateMap[date] = {};
      }
      if (rate.type === 'giftcard' || rate.type === 'crypto' || rate.type === 'wallet' || rate.type === 'store_wallet') {
        dateMap[date][rate.type] = rate.value;
      }
    });

    // Convert to array and fill gaps
    const sortedDates = Object.keys(dateMap).sort((a, b) => {
      return new Date(a).getTime() - new Date(b).getTime();
    });

    const chartData: RateChartData[] = [];
    let lastGiftcard: number | null = null;
    let lastCrypto: number | null = null;
    let lastWallet: number | null = null;
    let lastStoreWallet: number | null = null;

    sortedDates.forEach(date => {
      const dayData = dateMap[date];
      lastGiftcard = dayData.giftcard ?? lastGiftcard;
      lastCrypto = dayData.crypto ?? lastCrypto;
      lastWallet = dayData.wallet ?? lastWallet;
      lastStoreWallet = dayData.store_wallet ?? lastStoreWallet;

      chartData.push({
        date,
        giftcard: lastGiftcard,
        crypto: lastCrypto,
        wallet: lastWallet,
        store_wallet: lastStoreWallet,
      });
    });

    return chartData;
  };

  const chartData = prepareChartData();

  // Calculate trends
  const getTrend = (type: 'giftcard' | 'crypto' | 'wallet' | 'store_wallet') => {
    const typeRates = rates.filter(r => r.type === type).sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    if (typeRates.length < 2) return null;
    const first = typeRates[0].value;
    const last = typeRates[typeRates.length - 1].value;
    return last - first;
  };

  const giftcardTrend = getTrend('giftcard');
  const cryptoTrend = getTrend('crypto');
  const walletTrend = getTrend('wallet');
  const storeWalletTrend = getTrend('store_wallet');

  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4 holographic">Exchange Rates</h1>
          <p className="text-gray-300">Current rates and historical trends</p>
        </div>

        {/* Current Rates Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Gift Card Rate */}
          <div className="card-dark p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Gift Cards</h3>
              <DollarSign className="w-6 h-6 text-purple-400" />
            </div>
            <div className="text-3xl font-bold text-white mb-2">
              {currentRates.giftcard.toLocaleString()} MWK
            </div>
            <div className="text-sm text-gray-400 mb-2">per $1 USD</div>
            {giftcardTrend !== null && (
              <div className={`flex items-center text-sm ${giftcardTrend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {giftcardTrend >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                {giftcardTrend >= 0 ? '+' : ''}{giftcardTrend} MWK
              </div>
            )}
          </div>

          {/* Crypto Rate */}
          <div className="card-dark p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Cryptocurrency</h3>
              <DollarSign className="w-6 h-6 text-yellow-400" />
            </div>
            <div className="text-3xl font-bold text-white mb-2">
              {currentRates.crypto.toLocaleString()} MWK
            </div>
            <div className="text-sm text-gray-400 mb-2">per $1 USD</div>
            {cryptoTrend !== null && (
              <div className={`flex items-center text-sm ${cryptoTrend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {cryptoTrend >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                {cryptoTrend >= 0 ? '+' : ''}{cryptoTrend} MWK
              </div>
            )}
          </div>

          {/* Wallet Rate */}
          <div className="card-dark p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Payments (wallets + virtual cards)</h3>
              <DollarSign className="w-6 h-6 text-blue-400" />
            </div>
            <div className="text-3xl font-bold text-white mb-2">
              {currentRates.wallet.toLocaleString()} MWK
            </div>
            <div className="text-sm text-gray-400 mb-2">per $1 USD</div>
            {walletTrend !== null && (
              <div className={`flex items-center text-sm ${walletTrend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {walletTrend >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                {walletTrend >= 0 ? '+' : ''}{walletTrend} MWK
              </div>
            )}
          </div>

          {/* Store Wallet Rate */}
          <div className="card-dark p-6 rounded-xl border border-amber-500/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-amber-200">Store Wallet (top-up)</h3>
              <DollarSign className="w-6 h-6 text-amber-400" />
            </div>
            <div className="text-3xl font-bold text-amber-300 mb-2">
              {currentRates.store_wallet.toLocaleString()} MWK
            </div>
            <div className="text-sm text-gray-400 mb-2">per $1 USD · add money to your account</div>
            {storeWalletTrend !== null && (
              <div className={`flex items-center text-sm ${storeWalletTrend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {storeWalletTrend >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                {storeWalletTrend >= 0 ? '+' : ''}{storeWalletTrend} MWK
              </div>
            )}
          </div>
        </div>

        {/* Rate History Chart */}
        <div className="card-dark p-6 rounded-xl">
          <h2 className="text-2xl font-bold text-white mb-6">Rate History</h2>
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading chart data...</div>
          ) : chartData.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No rate history available</div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="date" 
                  stroke="#9CA3AF"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="#9CA3AF"
                  style={{ fontSize: '12px' }}
                  label={{ value: 'MWK per $1', angle: -90, position: 'insideLeft', style: { fill: '#9CA3AF' } }}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="giftcard" 
                  stroke="#a855f7" 
                  strokeWidth={2}
                  name="Gift Cards"
                  dot={{ fill: '#a855f7', r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="crypto" 
                  stroke="#eab308" 
                  strokeWidth={2}
                  name="Cryptocurrency"
                  dot={{ fill: '#eab308', r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="wallet" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="Payments"
                  dot={{ fill: '#3b82f6', r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="store_wallet" 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  name="Store Wallet"
                  dot={{ fill: '#f59e0b', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Rate Examples */}
        <div className="card-dark p-6 rounded-xl mt-6">
          <h2 className="text-2xl font-bold text-white mb-4">Rate Examples</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-dark-surface p-4 rounded-lg">
              <div className="text-sm text-gray-400 mb-2">$10 Gift Card</div>
              <div className="text-xl font-bold text-white">
                {getMwkAmountFromUsd(10, 'giftcard').toLocaleString()} MWK
              </div>
            </div>
            <div className="bg-dark-surface p-4 rounded-lg">
              <div className="text-sm text-gray-400 mb-2">$50 Crypto</div>
              <div className="text-xl font-bold text-white">
                {getMwkAmountFromUsd(50, 'crypto').toLocaleString()} MWK
              </div>
            </div>
            <div className="bg-dark-surface p-4 rounded-lg">
              <div className="text-sm text-gray-400 mb-2">$10 Store Wallet top-up</div>
              <div className="text-xl font-bold text-amber-300">
                {getMwkAmountFromUsd(10, 'store_wallet').toLocaleString()} MWK
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Rates;

