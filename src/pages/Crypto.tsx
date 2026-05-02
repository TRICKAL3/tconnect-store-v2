import React, { useEffect, useState } from 'react';
import { ShoppingCart, ArrowRight, CheckCircle, Wallet, Mail, User, FileText, Zap } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { getMwkAmountFromUsd } from '../utils/rates';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchProducts } from '../lib/api';
import type { CartItem } from '../lib/cartTypes';

type DeliveryMethod = '' | 'binance_id' | 'binance_email' | 'wallet';

const NETWORKS = ['BEP20', 'TRC20', 'ERC20'] as const;

interface CryptoOrder {
  coin: string;
  amountUsd: number;
  deliveryMethod: DeliveryMethod;
  binanceId: string;
  binanceEmail: string;
  walletAddress: string;
  network: (typeof NETWORKS)[number] | '';
  notes: string;
}

function deliverySummary(method: Exclude<DeliveryMethod, ''>): string {
  switch (method) {
    case 'binance_id':
      return 'Binance ID';
    case 'binance_email':
      return 'Binance email';
    case 'wallet':
      return 'Wallet address';
    default:
      return '';
  }
}

const Crypto: React.FC = () => {
  const { dispatch } = useCart();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState<CryptoOrder>({
    coin: 'USDT',
    amountUsd: 0,
    deliveryMethod: '',
    binanceId: '',
    binanceEmail: '',
    walletAddress: '',
    network: '',
    notes: '',
  });
  const [currentStep, setCurrentStep] = useState(1);
  const [inStock, setInStock] = useState(true);
  const [cryptoOptions, setCryptoOptions] = useState<string[]>(['USDT']);

  const handleInputChange = <K extends keyof CryptoOrder>(field: K, value: CryptoOrder[K]) => {
    setOrder((prev) => ({ ...prev, [field]: value }));
  };

  const validateDestination = (): string | null => {
    switch (order.deliveryMethod) {
      case 'binance_id':
        if (!order.binanceId.trim()) return 'Enter your Binance ID.';
        return null;
      case 'binance_email': {
        const e = order.binanceEmail.trim();
        if (!e) return 'Enter your Binance email.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'Enter a valid email address.';
        return null;
      }
      case 'wallet': {
        if (!order.walletAddress.trim()) return 'Enter your wallet address.';
        if (!NETWORKS.includes(order.network as (typeof NETWORKS)[number]))
          return 'Select a network: BEP20, TRC20, or ERC20.';
        return null;
      }
      default:
        return 'Choose how you want to receive your crypto.';
    }
  };

  const buildCartPayload = (): CartItem | null => {
    const err = validateDestination();
    if (err) {
      alert(err);
      return null;
    }
    if (!(order.amountUsd > 0) || order.amountUsd < 10) {
      alert('Enter an amount of at least $10.');
      return null;
    }
    const dm = order.deliveryMethod as Exclude<DeliveryMethod, ''>;

    const metadata: Record<string, unknown> = {
      coin: order.coin,
      amountUsd: order.amountUsd,
      deliveryMethod: dm,
      notes: order.notes.trim() || undefined,
    };
    if (dm === 'binance_id') metadata.binanceId = order.binanceId.trim();
    if (dm === 'binance_email') metadata.binanceEmail = order.binanceEmail.trim().toLowerCase();
    if (dm === 'wallet') {
      metadata.walletAddress = order.walletAddress.trim();
      metadata.network = order.network;
    }

    const methodLabel = deliverySummary(dm);
    return {
      id: `${order.coin.toLowerCase()}-${Date.now()}`,
      name: `${order.coin} · $${order.amountUsd.toFixed(2)} USD · ${methodLabel}`,
      price: order.amountUsd,
      category: 'Cryptocurrency',
      type: 'crypto',
      image: order.coin === 'USDT' ? '₮' : '🪙',
      quantity: 1,
      metadata,
    };
  };

  const addToCart = () => {
    if (!user) {
      navigate('/signin');
      return;
    }
    const payload = buildCartPayload();
    if (!payload) return;
    dispatch({ type: 'ADD_ITEM', payload });
    setCurrentStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const buyNow = () => {
    if (!user) {
      navigate('/signin');
      return;
    }
    const payload = buildCartPayload();
    if (!payload) return;
    dispatch({ type: 'ADD_ITEM', payload });
    navigate('/checkout');
  };

  useEffect(() => {
    (async () => {
      try {
        const products = await fetchProducts();
        const cryptoProducts = products.filter((p) => p.type === 'crypto');
        const coins = cryptoProducts.filter((p) => p.inStock).map((p) => p.name.toUpperCase());
        const hasInStockCrypto = cryptoProducts.some((p) => p.inStock);
        setInStock(hasInStockCrypto);
        if (coins.length) {
          setCryptoOptions(coins);
          setOrder((prev) => ({
            ...prev,
            coin: coins.includes(prev.coin) ? prev.coin : coins[0],
          }));
        } else {
          setCryptoOptions(['USDT']);
          setInStock(false);
        }
      } catch {
        /* keep defaults */
      }
    })();
  }, []);

  const renderStep1 = () => (
    <div className="card-dark p-4 sm:p-6 md:p-8 rounded-xl md:rounded-2xl">
      <div className="text-center mb-8">
        <div className="text-8xl mb-6 font-bold" style={{ color: '#f7931a' }}>
          ₿
        </div>
        <h2 className="text-3xl font-bold text-white mb-4">Buy Crypto</h2>
        <p className="text-gray-300 mb-6">
          Pick your coin and amount in USD. Next, tell us where to deliver—Binance ID, Binance email, or any wallet on
          BEP20 / TRC20 / ERC20.
        </p>

        <div className="mb-8">
          <div className="text-sm text-gray-400">
            Today rate example (MWK): {getMwkAmountFromUsd(1, 'crypto').toLocaleString()} per $1
          </div>
          <div className={`text-lg font-semibold ${inStock ? 'text-neon-green' : 'text-neon-red'}`}>
            {inStock ? '✓ In Stock' : '✗ Out of Stock'}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-lg font-bold text-white mb-3">Coin</label>
          <select
            value={order.coin}
            onChange={(e) => handleInputChange('coin', e.target.value)}
            className="w-full border-2 border-dark-border rounded-xl px-4 py-3 text-lg focus:ring-2 focus:ring-neon-blue focus:border-transparent transition-all duration-200 bg-dark-surface text-white"
          >
            {cryptoOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-lg font-bold text-white mb-3">Amount (USD)</label>
          <input
            type="number"
            min="10"
            step="0.01"
            placeholder="Enter amount in USD"
            value={order.amountUsd || ''}
            onChange={(e) => handleInputChange('amountUsd', parseFloat(e.target.value) || 0)}
            className="w-full border-2 border-dark-border rounded-xl px-4 py-3 text-lg focus:ring-2 focus:ring-neon-blue focus:border-transparent transition-all duration-200 bg-dark-surface text-white"
          />
          {order.amountUsd > 0 && (
            <div className="text-lg text-gray-300 mt-2 font-semibold">
              MWK ≈ {getMwkAmountFromUsd(order.amountUsd, 'crypto').toLocaleString()}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setCurrentStep(2)}
          disabled={!inStock || !order.amountUsd || order.amountUsd < 10}
          className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center space-x-3 transform hover:scale-105 ${
            inStock && order.amountUsd && order.amountUsd >= 10
              ? 'btn-cyber text-white'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          <ArrowRight className="w-5 h-5" />
          <span>{inStock ? 'Delivery details' : 'Out of Stock'}</span>
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="card-dark p-4 sm:p-6 md:p-8 rounded-xl md:rounded-2xl">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-4">Where should we deliver?</h2>
        <p className="text-gray-300">Choose Binance ID, Binance email, or an external wallet (BEP20, TRC20, or ERC20 only).</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
        {(
          [
            { id: 'binance_id' as const, title: 'Binance ID', desc: 'Your Binance user ID', Icon: User },
            { id: 'binance_email' as const, title: 'Binance email', desc: 'Email on your Binance account', Icon: Mail },
            { id: 'wallet' as const, title: 'Wallet address', desc: 'Any wallet — choose network below', Icon: Wallet },
          ] as const
        ).map(({ id, title, desc, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => handleInputChange('deliveryMethod', id)}
            className={`p-4 sm:p-5 rounded-xl border-2 transition-all duration-300 text-left active:scale-[0.99] ${
              order.deliveryMethod === id
                ? 'border-neon-blue bg-neon-blue/10 neon-glow'
                : 'border-dark-border hover:border-neon-blue/50'
            }`}
          >
            <div className="flex items-start space-x-3">
              <Icon className="w-7 h-7 text-neon-blue flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-bold text-white">{title}</h3>
                <p className="text-gray-400 text-xs sm:text-sm mt-1">{desc}</p>
              </div>
              {order.deliveryMethod === id && <CheckCircle className="w-5 h-5 text-neon-blue flex-shrink-0" />}
            </div>
          </button>
        ))}
      </div>

      <div className="space-y-6 border-t border-dark-border pt-6">
        {order.deliveryMethod === 'binance_id' && (
          <div>
            <label className="block text-lg font-bold text-white mb-3">
              <User className="w-5 h-5 inline mr-2" />
              Binance ID
            </label>
            <input
              type="text"
              placeholder="Your Binance ID"
              value={order.binanceId}
              onChange={(e) => handleInputChange('binanceId', e.target.value)}
              className="w-full border-2 border-dark-border rounded-xl px-4 py-3 text-lg focus:ring-2 focus:ring-neon-blue focus:border-transparent bg-dark-surface text-white"
            />
            <p className="text-sm text-gray-400 mt-2">Find it in Binance profile or account settings.</p>
          </div>
        )}

        {order.deliveryMethod === 'binance_email' && (
          <div>
            <label className="block text-lg font-bold text-white mb-3">
              <Mail className="w-5 h-5 inline mr-2" />
              Binance email
            </label>
            <input
              type="email"
              placeholder="same email linked to Binance"
              value={order.binanceEmail}
              onChange={(e) => handleInputChange('binanceEmail', e.target.value)}
              className="w-full border-2 border-dark-border rounded-xl px-4 py-3 text-lg focus:ring-2 focus:ring-neon-blue focus:border-transparent bg-dark-surface text-white"
            />
          </div>
        )}

        {order.deliveryMethod === 'wallet' && (
          <>
            <div>
              <label className="block text-lg font-bold text-white mb-3">Network</label>
              <select
                value={order.network}
                onChange={(e) =>
                  handleInputChange('network', e.target.value as CryptoOrder['network'])
                }
                className="w-full border-2 border-dark-border rounded-xl px-4 py-3 text-lg focus:ring-2 focus:ring-neon-blue focus:border-transparent bg-dark-surface text-white"
              >
                <option value="">Select network</option>
                {NETWORKS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <p className="text-sm text-gray-400 mt-2">Wallet transfers are supported on BEP20, TRC20, and ERC20 only.</p>
            </div>
            <div>
              <label className="block text-lg font-bold text-white mb-3">
                <Wallet className="w-5 h-5 inline mr-2" />
                Wallet address
              </label>
              <input
                type="text"
                placeholder="Receiving address"
                value={order.walletAddress}
                onChange={(e) => handleInputChange('walletAddress', e.target.value)}
                className="w-full border-2 border-dark-border rounded-xl px-4 py-3 text-lg focus:ring-2 focus:ring-neon-blue focus:border-transparent bg-dark-surface text-white font-mono text-sm sm:text-base"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-lg font-bold text-white mb-3">
            <FileText className="w-5 h-5 inline mr-2" />
            Notes <span className="text-gray-500 font-normal">(optional)</span>
          </label>
          <textarea
            placeholder="Anything else we should know"
            value={order.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            rows={3}
            className="w-full border-2 border-dark-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-neon-blue bg-dark-surface text-white resize-none"
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-8">
        <button
          type="button"
          onClick={() => setCurrentStep(1)}
          className="flex-1 cyber-border text-white py-3 px-6 rounded-xl font-bold transition-all hover:scale-[1.02]"
        >
          Back
        </button>
        <button
          type="button"
          onClick={addToCart}
          disabled={!order.deliveryMethod}
          className={`flex-1 py-3 px-6 rounded-xl font-bold transition-all flex items-center justify-center space-x-2 ${
            order.deliveryMethod ? 'btn-cyber text-white hover:scale-[1.02]' : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          <ShoppingCart className="w-5 h-5" />
          <span>Add to cart</span>
        </button>
        <button
          type="button"
          onClick={buyNow}
          disabled={!order.deliveryMethod}
          className={`flex-1 py-3 px-6 rounded-xl font-bold transition-all flex items-center justify-center space-x-2 ${
            order.deliveryMethod ? 'bg-white text-dark-bg hover:bg-gray-100' : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Zap className="w-5 h-5" />
          <span>Buy now</span>
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="card-dark p-4 sm:p-6 md:p-8 rounded-xl md:rounded-2xl text-center">
      <div className="text-6xl mb-6">✅</div>
      <h2 className="text-3xl font-bold text-white mb-4">Added to cart</h2>
      <p className="text-gray-300 mb-8">Your {order.coin} order is in the cart. Continue to checkout when you’re ready.</p>

      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate('/cart')}
          className="w-full btn-cyber text-white py-4 px-8 rounded-xl font-bold text-lg transition-all hover:scale-[1.02]"
        >
          Go to cart
        </button>
        <button
          type="button"
          onClick={() => {
            setCurrentStep(1);
            setOrder({
              coin: cryptoOptions[0] || 'USDT',
              amountUsd: 0,
              deliveryMethod: '',
              binanceId: '',
              binanceEmail: '',
              walletAddress: '',
              network: '',
              notes: '',
            });
          }}
          className="w-full cyber-border text-white py-3 px-6 rounded-xl font-bold transition-all hover:scale-[1.02]"
        >
          Another order
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-12 text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 holographic">Buy Crypto</h1>
          <p className="text-base md:text-lg text-gray-300 max-w-4xl mx-auto leading-relaxed">
            Stable coins supported. Deliver to Binance (ID or email) or any wallet on BEP20, TRC20, or ERC20.
          </p>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-center space-x-2 sm:space-x-4 overflow-x-auto pb-2">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center flex-shrink-0">
                <div
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm sm:text-base transition-all ${
                    currentStep >= step ? 'bg-neon-blue text-white neon-glow scale-110' : 'bg-dark-surface text-gray-400'
                  }`}
                >
                  {step}
                </div>
                {step < 3 && (
                  <div
                    className={`w-8 sm:w-16 md:w-24 h-1 mx-2 transition-all ${currentStep > step ? 'bg-neon-blue' : 'bg-dark-surface'}`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-3 text-xs sm:text-sm gap-6 sm:gap-12 md:gap-20">
            <span className="text-gray-300 whitespace-nowrap">Amount</span>
            <span className="text-gray-300 whitespace-nowrap">Deliver to</span>
            <span className="text-gray-300 whitespace-nowrap">Done</span>
          </div>
        </div>

        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}

        <div className="mt-12 bg-neon-orange/10 border border-neon-orange/30 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-neon-orange mb-2">Security</h3>
          <p className="text-neon-orange/80 text-sm">
            Double-check Binance IDs, emails, and wallet addresses before paying. Wrong details can delay or lose funds.
            For external wallets, the network must match (BEP20, TRC20, or ERC20).
          </p>
        </div>
      </div>
    </div>
  );
};

export default Crypto;
