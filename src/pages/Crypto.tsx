import React, { useEffect, useState } from 'react';
import { ShoppingCart, ArrowRight, CheckCircle, Wallet, Mail, User, FileText } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { getMwkAmountFromUsd } from '../utils/rates';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchProducts } from '../lib/api';

interface Exchange {
  id: string;
  name: string;
  logo: string;
  description: string;
  supported: boolean;
}

interface CryptoOrder {
  coin: string;
  amountUsd: number;
  exchange: string;
  customExchange?: string;
  network?: string;
  walletAddress: string;
  email: string;
  exchangeId: string;
  notes: string;
}

const Crypto: React.FC = () => {
  const { dispatch } = useCart();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState<CryptoOrder>({
    coin: 'USDT',
    amountUsd: 0,
    exchange: '',
    customExchange: '',
    network: '',
    walletAddress: '',
    email: '',
    exchangeId: '',
    notes: ''
  });
  const [currentStep, setCurrentStep] = useState(1);
  const [inStock] = useState(true);
  const [cryptoOptions, setCryptoOptions] = useState<string[]>(['USDT']);

  const exchanges: Exchange[] = [
    {
      id: 'binance',
      name: 'Binance',
      logo: '🟡',
      description: 'World\'s largest cryptocurrency exchange',
      supported: true
    },
    {
      id: 'bybit',
      name: 'Bybit',
      logo: '🔵',
      description: 'Professional trading platform',
      supported: true
    },
    {
      id: 'okx',
      name: 'OKX',
      logo: '⚫',
      description: 'Global crypto exchange',
      supported: true
    },
    {
      id: 'kucoin',
      name: 'KuCoin',
      logo: '🟢',
      description: 'The People\'s Exchange',
      supported: true
    },
    {
      id: 'huobi',
      name: 'Huobi',
      logo: '🔴',
      description: 'Global digital asset exchange',
      supported: true
    },
    {
      id: 'gate',
      name: 'Gate.io',
      logo: '🟠',
      description: 'Secure crypto trading platform',
      supported: true
    },
    {
      id: 'mexc',
      name: 'MEXC',
      logo: '🟣',
      description: 'Global digital asset trading platform',
      supported: true
    },
    {
      id: 'bitget',
      name: 'Bitget',
      logo: '🔵',
      description: 'Social trading platform',
      supported: true
    }
  ];

  const handleInputChange = (field: keyof CryptoOrder, value: string | number) => {
    setOrder(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleExchangeSelect = (exchangeId: string) => {
    setOrder(prev => ({
      ...prev,
      exchange: exchangeId
    }));
  };

  // Scroll to top when step changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  const addToCart = () => {
    if (!user) { navigate('/signin'); return; }
    const selectedExchange = order.exchange === 'other' ? (order.customExchange || 'Other') : exchanges.find(e => e.id === order.exchange)?.name;
    if (order.amountUsd > 0 && order.exchange && order.walletAddress) {
      dispatch({
        type: 'ADD_ITEM',
        payload: {
          id: `${order.coin.toLowerCase()}-${Date.now()}`,
          name: `${order.coin} Order - ${selectedExchange}`,
          price: order.amountUsd,
          category: 'Cryptocurrency',
          type: 'crypto',
          image: order.coin === 'USDT' ? '₮' : '🪙',
          quantity: 1,
          metadata: {
            coin: order.coin,
            amountUsd: order.amountUsd,
            exchange: order.exchange === 'other' ? (order.customExchange || 'Other') : exchanges.find(e => e.id === order.exchange)?.name,
            network: order.network || '',
            walletAddress: order.walletAddress,
            email: order.email,
            exchangeId: order.exchangeId,
            notes: order.notes
          }
        }
      });
      setCurrentStep(4);
      // Scroll to top on mobile after adding to cart
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const products = await fetchProducts();
        const coins = products.filter(p => p.type === 'crypto' && p.inStock).map(p => p.name.toUpperCase());
        if (coins.length) setCryptoOptions(coins);
      } catch {}
    })();
  }, []);

  const renderStep1 = () => (
    <div className="card-dark p-4 sm:p-6 md:p-8 rounded-xl md:rounded-2xl">
      <div className="text-center mb-8">
        <div className="text-8xl mb-6 font-bold" style={{ color: '#f7931a' }}>₿</div>
        <h2 className="text-3xl font-bold text-white mb-4">Buy Crypto</h2>
        <p className="text-gray-300 mb-6">Select coin, exchange and amount (USD). Stable coins supported.</p>
        
        {/* Price and Stock Status */}
        <div className="mb-8">
          <div className="text-sm text-gray-400">Today rate example (MWK): {getMwkAmountFromUsd(1, 'crypto').toLocaleString()} per $1</div>
          <div className={`text-lg font-semibold ${
            inStock ? 'text-neon-green' : 'text-neon-red'
          }`}>
            {inStock ? '✓ In Stock' : '✗ Out of Stock'}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-lg font-bold text-white mb-3">
            Coin
          </label>
          <select
            value={order.coin}
            onChange={(e) => handleInputChange('coin', e.target.value)}
            className="w-full border-2 border-dark-border rounded-xl px-4 py-3 text-lg focus:ring-2 focus:ring-neon-blue focus:border-transparent transition-all duration-200 bg-dark-surface text-white"
          >
            {cryptoOptions.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-lg font-bold text-white mb-3">
            Amount (USD)
          </label>
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
          onClick={() => {
            setCurrentStep(2);
            setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
          }}
          disabled={!order.amountUsd || order.amountUsd < 10}
          className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center space-x-3 transform hover:scale-105 ${
            order.amountUsd && order.amountUsd >= 10
              ? 'btn-cyber text-white'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          <ArrowRight className="w-5 h-5" />
          <span>Select Exchange</span>
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="card-dark p-4 sm:p-6 md:p-8 rounded-xl md:rounded-2xl">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-4">Select Exchange</h2>
        <p className="text-gray-300">Choose your preferred exchange for receiving USDT</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {exchanges.map((exchange) => (
          <button
            key={exchange.id}
            onClick={() => handleExchangeSelect(exchange.id)}
            className={`p-4 sm:p-6 rounded-lg sm:rounded-xl border-2 transition-all duration-300 text-left active:scale-95 ${
              order.exchange === exchange.id
                ? 'border-neon-blue bg-neon-blue/10 neon-glow'
                : 'border-dark-border hover:border-neon-blue/50'
            }`}
          >
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="text-2xl sm:text-3xl flex-shrink-0">{exchange.logo}</div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-white truncate">{exchange.name}</h3>
                <p className="text-gray-300 text-xs sm:text-sm line-clamp-2">{exchange.description}</p>
              </div>
              {order.exchange === exchange.id && (
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-neon-blue flex-shrink-0 ml-auto" />
              )}
            </div>
          </button>
        ))}
        <div className={`p-6 rounded-xl border-2 ${order.exchange === 'other' ? 'border-neon-blue bg-neon-blue/10' : 'border-dark-border'}`}>
          <label className="block text-white font-bold mb-2">Other Exchange</label>
          <input
            type="text"
            placeholder="Type exchange name"
            value={order.exchange === 'other' ? (order.customExchange || '') : ''}
            onFocus={() => handleExchangeSelect('other')}
            onChange={(e) => {
              handleExchangeSelect('other');
              handleInputChange('customExchange', e.target.value);
            }}
            className="w-full border-2 border-dark-border rounded-xl px-4 py-3 text-lg focus:ring-2 focus:ring-neon-blue focus:border-transparent transition-all duration-200 bg-dark-surface text-white"
          />
        </div>
      </div>

      <div className="flex space-x-4">
        <button
          onClick={() => {
            setCurrentStep(1);
            setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
          }}
          className="flex-1 cyber-border text-white py-3 px-6 rounded-xl font-bold transition-all duration-300 hover:scale-105"
        >
          Back
        </button>
        <button
          onClick={() => {
            setCurrentStep(3);
            setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
          }}
          disabled={!order.exchange}
          className={`flex-1 py-3 px-6 rounded-xl font-bold transition-all duration-300 flex items-center justify-center space-x-3 transform hover:scale-105 ${
            order.exchange
              ? 'btn-cyber text-white'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          <ArrowRight className="w-5 h-5" />
          <span>Continue</span>
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="card-dark p-4 sm:p-6 md:p-8 rounded-xl md:rounded-2xl">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-4">Exchange Details</h2>
        <p className="text-gray-300">Provide wallet details and choose the correct network for your coin</p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-lg font-bold text-white mb-3">
            Network
          </label>
          <select
            value={order.network || ''}
            onChange={(e) => handleInputChange('network', e.target.value)}
            className="w-full border-2 border-dark-border rounded-xl px-4 py-3 text-lg focus:ring-2 focus:ring-neon-blue focus:border-transparent transition-all duration-200 bg-dark-surface text-white"
          >
            {order.coin === 'USDT' && (<>
              <option value="TRC20">TRC20</option>
              <option value="ERC20">ERC20</option>
              <option value="BEP20">BEP20</option>
            </>)}
            {order.coin === 'USDC' && (<>
              <option value="ERC20">ERC20</option>
              <option value="TRC20">TRC20</option>
              <option value="BEP20">BEP20</option>
            </>)}
            {order.coin === 'BUSD' && (<>
              <option value="BEP20">BEP20</option>
              <option value="ERC20">ERC20</option>
            </>)}
            {order.coin === 'BTC' && (<>
              <option value="BTC">BTC (Legacy/SegWit)</option>
              <option value="BTC Taproot">BTC Taproot</option>
            </>)}
            {order.coin === 'ETH' && (<>
              <option value="ERC20">ERC20</option>
            </>)}
          </select>
          <p className="text-sm text-gray-400 mt-2">Make sure the network matches your receiving address.</p>
        </div>
        <div>
          <label className="block text-lg font-bold text-white mb-3">
            <Wallet className="w-5 h-5 inline mr-2" />
            Wallet Address
          </label>
          <input
            type="text"
            placeholder="Enter your wallet address"
            value={order.walletAddress}
            onChange={(e) => handleInputChange('walletAddress', e.target.value)}
            className="w-full border-2 border-dark-border rounded-xl px-4 py-3 text-lg focus:ring-2 focus:ring-neon-blue focus:border-transparent transition-all duration-200 bg-dark-surface text-white"
          />
          <p className="text-sm text-gray-400 mt-2">We support the network you select above for this coin.</p>
        </div>

        <div>
          <label className="block text-lg font-bold text-white mb-3">
            <Mail className="w-5 h-5 inline mr-2" />
            Email Address
          </label>
          <input
            type="email"
            placeholder="Enter your email address"
            value={order.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className="w-full border-2 border-dark-border rounded-xl px-4 py-3 text-lg focus:ring-2 focus:ring-neon-blue focus:border-transparent transition-all duration-200 bg-dark-surface text-white"
          />
        </div>

        <div>
          <label className="block text-lg font-bold text-white mb-3">
            <User className="w-5 h-5 inline mr-2" />
            Exchange ID (Optional)
          </label>
          <input
            type="text"
            placeholder="Enter your exchange user ID"
            value={order.exchangeId}
            onChange={(e) => handleInputChange('exchangeId', e.target.value)}
            className="w-full border-2 border-dark-border rounded-xl px-4 py-3 text-lg focus:ring-2 focus:ring-neon-blue focus:border-transparent transition-all duration-200 bg-dark-surface text-white"
          />
        </div>

        <div>
          <label className="block text-lg font-bold text-white mb-3">
            <FileText className="w-5 h-5 inline mr-2" />
            Additional Notes (Optional)
          </label>
          <textarea
            placeholder="Any additional information or special instructions"
            value={order.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            rows={3}
            className="w-full border-2 border-dark-border rounded-xl px-4 py-3 text-lg focus:ring-2 focus:ring-neon-blue focus:border-transparent transition-all duration-200 bg-dark-surface text-white resize-none"
          />
        </div>
      </div>

      <div className="flex space-x-4 mt-8">
        <button
          onClick={() => {
            setCurrentStep(2);
            setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
          }}
          className="flex-1 cyber-border text-white py-3 px-6 rounded-xl font-bold transition-all duration-300 hover:scale-105"
        >
          Back
        </button>
        <button
          onClick={addToCart}
          disabled={!order.walletAddress || !order.email}
          className={`flex-1 py-3 px-6 rounded-xl font-bold transition-all duration-300 flex items-center justify-center space-x-3 transform hover:scale-105 ${
            order.walletAddress && order.email
              ? 'btn-cyber text-white'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          <ShoppingCart className="w-5 h-5" />
          <span>Add to Cart</span>
        </button>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="card-dark p-4 sm:p-6 md:p-8 rounded-xl md:rounded-2xl text-center">
      <div className="text-6xl mb-6">✅</div>
      <h2 className="text-3xl font-bold text-white mb-4">Order Added to Cart!</h2>
      <p className="text-gray-300 mb-8">
        Your USDT order has been added to your cart. You can now proceed to checkout.
      </p>
      
      <div className="space-y-4">
        <button
          onClick={() => navigate('/cart')}
          className="w-full btn-cyber text-white py-4 px-8 rounded-xl font-bold text-lg transition-all duration-300 hover:scale-105"
        >
          Go to Cart
        </button>
        <button
          onClick={() => {
            setCurrentStep(1);
            setOrder({
              coin: 'USDT',
              amountUsd: 0,
              exchange: '',
              customExchange: '',
              network: '',
              walletAddress: '',
              email: '',
              exchangeId: '',
              notes: ''
            });
            setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
          }}
          className="w-full cyber-border text-white py-3 px-6 rounded-xl font-bold transition-all duration-300 hover:scale-105"
        >
          Place Another Order
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 holographic">
            Buy Crypto
          </h1>
          <p className="text-base md:text-lg text-gray-300 max-w-4xl mx-auto leading-relaxed">
            Purchase supported coins and receive directly to your exchange wallet
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-2 sm:space-x-4 overflow-x-auto pb-2">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center flex-shrink-0">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm sm:text-base transition-all duration-300 ${
                  currentStep >= step
                    ? 'bg-neon-blue text-white neon-glow scale-110'
                    : 'bg-dark-surface text-gray-400'
                }`}>
                  {step}
                </div>
                {step < 4 && (
                  <div className={`w-8 sm:w-12 md:w-16 h-1 mx-1 sm:mx-2 transition-all duration-300 ${
                    currentStep > step ? 'bg-neon-blue' : 'bg-dark-surface'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-3 sm:mt-4 space-x-4 sm:space-x-8 md:space-x-16 text-xs sm:text-sm">
            <span className="text-gray-300 whitespace-nowrap">Amount</span>
            <span className="text-gray-300 whitespace-nowrap">Exchange</span>
            <span className="text-gray-300 whitespace-nowrap hidden sm:inline">Details</span>
            <span className="text-gray-300 whitespace-nowrap hidden sm:inline">Complete</span>
          </div>
        </div>

        {/* Step Content */}
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}

        {/* Security Notice */}
        <div className="mt-12 bg-neon-orange/10 border border-neon-orange/30 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-neon-orange mb-2">
            Security Notice
          </h3>
          <p className="text-neon-orange/80 text-sm">
            All USDT transactions are secured with bank-level encryption. 
            We only support TRC20 network for USDT transfers. Please ensure you have 
            provided the correct TRC20 wallet address for your selected exchange.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Crypto;