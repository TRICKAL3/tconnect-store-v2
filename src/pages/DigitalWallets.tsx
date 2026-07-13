import React, { useEffect, useState } from 'react';
import { ShoppingCart, Search, Filter, Shield } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMwkAmountFromUsd } from '../utils/rates';
import { fetchProducts } from '../lib/api';
import {
  GIFTCARD_BUYER_MAX_USD,
  clampGiftCardBuyerUsd,
  defaultBuyerAmountFromCatalog,
} from '../lib/giftCardPricing';

interface DigitalWallet {
  id: string;
  name: string;
  type: 'virtual-card' | 'wallet' | 'payment';
  price: number;
  image: string;
  description: string;
  features: string[];
  rating: number;
  inStock: boolean;
}

/** Map API / DB product.type to payments tab kind (handles casing, spaces, common aliases). */
function normalizePaymentsProductType(raw: unknown): 'virtual-card' | 'wallet' | null {
  const t = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
  if (t === 'wallet' || t === 'digital-wallet') return 'wallet';
  if (t === 'virtual-card' || t === 'virtualcard') return 'virtual-card';
  return null;
}

const DigitalWallets: React.FC = () => {
  const VIRTUAL_CARD_MIN_USD = 5;
  const { dispatch } = useCart();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');

  const types = [
    'All', 'Virtual Cards', 'Digital Wallets'
  ];

  const [digitalWallets, setDigitalWallets] = useState<DigitalWallet[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const products = await fetchProducts();
        const mapped: DigitalWallet[] = products.flatMap((p) => {
          const kind = normalizePaymentsProductType(p.type);
          if (!kind) return [];
          return [
            {
              id: p.id,
              name: p.name,
              type: kind,
              price: p.priceUsd,
              image: '💳',
              description: p.description || '',
              features: [] as string[],
              rating: 5,
              inStock: p.inStock,
            },
          ];
        });
        setDigitalWallets(mapped);
      } catch {}
    })();
  }, []);

  const filteredWallets = digitalWallets.filter(wallet => {
    const matchesType = selectedType === 'All' || 
      (selectedType === 'Virtual Cards' && wallet.type === 'virtual-card') ||
      (selectedType === 'Digital Wallets' && wallet.type === 'wallet');
    const matchesSearch = wallet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         wallet.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const sortedWallets = [...filteredWallets].sort((a, b) => {
    switch (sortBy) {
      case 'price-low':
        return a.price - b.price;
      case 'price-high':
        return b.price - a.price;
      case 'rating':
        return b.rating - a.rating;
      case 'name':
      default:
        return a.name.localeCompare(b.name);
    }
  });

  const [amountByWallet, setAmountByWallet] = useState<Record<string, number>>({});
  const [emailByWallet, setEmailByWallet] = useState<Record<string, string>>({});

  const canCheckoutVirtualCardUsd = (amount: number) =>
    amount >= VIRTUAL_CARD_MIN_USD && amount <= GIFTCARD_BUYER_MAX_USD;

  // removed unused addToCart (virtual cards use custom amount and go to checkout)

  const addToCartAndCheckout = (wallet: DigitalWallet) => {
    if (!user) { 
      window.scrollTo({ top: 0, behavior: 'smooth' });
      navigate('/signin'); 
      return; 
    }
    const amountUsd = Math.max(25, amountByWallet[wallet.id] || 0);
    const email = (emailByWallet[wallet.id] || '').trim();
    dispatch({
      type: 'ADD_ITEM',
      payload: {
        id: `${wallet.id}-${Date.now()}`,
        name: `${wallet.name} Top-up${email ? ` (${email})` : ''}`,
        price: amountUsd,
        category: 'Digital Wallet Top-up',
        type: 'wallet',
        image: wallet.image,
        quantity: 1,
        metadata: {
          walletEmail: email,
          walletName: wallet.name,
          amountUsd: amountUsd
        }
      }
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    navigate('/checkout');
  };

  const addVirtualCardAndCheckout = (wallet: DigitalWallet) => {
    if (!user) { 
      window.scrollTo({ top: 0, behavior: 'smooth' });
      navigate('/signin'); 
      return; 
    }
    const amountUsd = clampGiftCardBuyerUsd(amountByWallet[wallet.id] || 0);
    if (!canCheckoutVirtualCardUsd(amountUsd)) return;
    dispatch({
      type: 'ADD_ITEM',
      payload: {
        id: wallet.id,
        name: `${wallet.name} (Virtual Card)`,
        price: amountUsd,
        category: 'Virtual Cards',
        type: 'virtual-card',
        image: wallet.image,
        quantity: 1
      }
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    navigate('/checkout');
  };

  const renderWalletTiles = (list: DigitalWallet[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {list.map((wallet) => (
        <div key={wallet.id} className="group card-dark hover-lift">
          <div className="p-8">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300 neon-glow">
                {wallet.image}
              </div>
              <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-neon-blue font-mono">{wallet.name}</h3>
              <p className="text-xs uppercase tracking-wide text-neon-blue/90 mb-1">
                {wallet.type === 'virtual-card' ? 'Virtual card' : 'Digital wallet'}
              </p>
              <p className="text-lg text-gray-300 mb-4 leading-relaxed">{wallet.description}</p>
              <div className="flex items-center justify-center space-x-2 mb-4">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <span
                      key={i}
                      className={`text-yellow-400 ${i < Math.floor(wallet.rating) ? 'text-yellow-400' : 'text-gray-500'}`}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <span className="text-lg font-semibold text-gray-300">{wallet.rating}</span>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-lg font-bold text-white mb-3 font-mono">Key features</h4>
              <ul className="space-y-2">
                {wallet.features.map((feature, index) => (
                  <li key={index} className="flex items-center space-x-2 text-gray-300">
                    <Shield className="w-4 h-4 text-neon-green" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {wallet.type === 'wallet' ? (
              <div className="text-center">
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-white mb-2">Amount (USD) • Min $25</label>
                  <input
                    type="number"
                    min={25}
                    step="0.01"
                    value={amountByWallet[wallet.id] || ''}
                    onChange={(e) =>
                      setAmountByWallet((prev) => ({ ...prev, [wallet.id]: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full px-4 py-3 bg-dark-surface border border-dark-border rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-neon-blue focus:border-transparent"
                    placeholder="Top-up amount in USD"
                  />
                  <label className="block text-sm font-semibold text-white mb-2 mt-4">Registered email for wallet</label>
                  <input
                    type="email"
                    value={emailByWallet[wallet.id] || ''}
                    onChange={(e) => setEmailByWallet((prev) => ({ ...prev, [wallet.id]: e.target.value }))}
                    className="w-full px-4 py-3 bg-dark-surface border border-dark-border rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-neon-blue focus:border-transparent"
                    placeholder="Email on this wallet account"
                  />
                  {amountByWallet[wallet.id] > 0 && (
                    <div className="text-sm text-gray-300 mt-2">
                      MWK ≈ {getMwkAmountFromUsd(amountByWallet[wallet.id], 'wallet').toLocaleString()}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => addToCartAndCheckout(wallet)}
                  disabled={
                    !wallet.inStock ||
                    (amountByWallet[wallet.id] || 0) < 25 ||
                    !(emailByWallet[wallet.id] || '').includes('@')
                  }
                  className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center space-x-3 transform hover:scale-105 ${
                    wallet.inStock &&
                    (amountByWallet[wallet.id] || 0) >= 25 &&
                    (emailByWallet[wallet.id] || '').includes('@')
                      ? 'btn-cyber text-white neon-glow'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <ShoppingCart className="w-5 h-5" />
                  <span>Proceed to checkout</span>
                </button>
              </div>
            ) : (
              <div className="text-center">
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-white mb-2">
                    Amount (USD) • ${VIRTUAL_CARD_MIN_USD}–${GIFTCARD_BUYER_MAX_USD}
                  </label>
                  <input
                    type="number"
                    min={VIRTUAL_CARD_MIN_USD}
                    max={GIFTCARD_BUYER_MAX_USD}
                    step="0.01"
                    value={amountByWallet[wallet.id] ?? defaultBuyerAmountFromCatalog(wallet.price)}
                    onChange={(e) =>
                      setAmountByWallet((prev) => ({
                        ...prev,
                        [wallet.id]: clampGiftCardBuyerUsd(parseFloat(e.target.value) || 0),
                      }))
                    }
                    className="w-full px-4 py-3 bg-dark-surface border border-dark-border rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-neon-blue focus:border-transparent"
                    placeholder="Card value in USD"
                  />
                  {canCheckoutVirtualCardUsd(amountByWallet[wallet.id] ?? 0) && (
                    <div className="text-sm text-gray-300 mt-2">
                      MWK ≈{' '}
                      {getMwkAmountFromUsd(
                        clampGiftCardBuyerUsd(amountByWallet[wallet.id] ?? 0),
                        'wallet'
                      ).toLocaleString()}
                    </div>
                  )}
                  {(amountByWallet[wallet.id] ?? 0) > 0 &&
                    !canCheckoutVirtualCardUsd(clampGiftCardBuyerUsd(amountByWallet[wallet.id] ?? 0)) && (
                      <div className="text-sm text-amber-300 mt-2">
                        Minimum virtual-card amount is ${VIRTUAL_CARD_MIN_USD.toFixed(2)}.
                      </div>
                    )}
                </div>
                <button
                  onClick={() => addVirtualCardAndCheckout(wallet)}
                  disabled={
                    !wallet.inStock ||
                    !canCheckoutVirtualCardUsd(clampGiftCardBuyerUsd(amountByWallet[wallet.id] || 0))
                  }
                  className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center space-x-3 transform hover:scale-105 ${
                    wallet.inStock &&
                    canCheckoutVirtualCardUsd(clampGiftCardBuyerUsd(amountByWallet[wallet.id] || 0))
                      ? 'btn-cyber text-white neon-glow'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <ShoppingCart className="w-5 h-5" />
                  <span>Proceed to checkout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const virtualList = sortedWallets.filter((w) => w.type === 'virtual-card');
  const digitalList = sortedWallets.filter((w) => w.type === 'wallet');

  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 font-mono holographic">Payments</h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-2">Virtual cards and digital wallets</p>
          <p className="text-base md:text-lg text-gray-300 max-w-4xl mx-auto leading-relaxed">
            Choose a virtual card or digital wallet below. Virtual cards: pick any amount $5–$1000 (like gift cards).
            Digital wallets: min $25 top-up. MWK uses today’s wallet rate.
          </p>
        </div>

        <div className="card-dark mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search virtual cards & digital wallets…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-dark-border rounded-xl bg-dark-surface text-white focus:ring-2 focus:ring-neon-blue focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {types.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${
                    selectedType === type
                      ? 'bg-neon-blue text-white neon-glow'
                      : 'bg-dark-surface text-gray-300 hover:bg-dark-card border border-dark-border'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-dark-border rounded-xl px-3 py-2 bg-dark-surface text-white focus:ring-2 focus:ring-neon-blue focus:border-transparent"
              >
                <option value="name">Sort by name</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Rating</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-gray-300">
            Showing {sortedWallets.length} {sortedWallets.length === 1 ? 'product' : 'products'}
            {selectedType !== 'All' ? ` · ${selectedType}` : ''}
          </p>
        </div>

        {sortedWallets.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-white mb-2">Nothing matches</h3>
            <p className="text-gray-300">Try another search or filter.</p>
          </div>
        ) : selectedType === 'All' ? (
          <div className="space-y-14">
            <section aria-labelledby="virtual-cards-heading">
              <h2 id="virtual-cards-heading" className="text-2xl md:text-3xl font-bold text-white mb-6">
                Virtual cards
              </h2>
              {virtualList.length === 0 ? (
                <p className="text-gray-400">No virtual cards in catalog.</p>
              ) : (
                renderWalletTiles(virtualList)
              )}
            </section>
            <section aria-labelledby="digital-wallets-heading">
              <h2 id="digital-wallets-heading" className="text-2xl md:text-3xl font-bold text-white mb-6">
                Digital wallets
              </h2>
              {digitalList.length === 0 ? (
                <p className="text-gray-400">No digital wallets in catalog.</p>
              ) : (
                renderWalletTiles(digitalList)
              )}
            </section>
          </div>
        ) : (
          renderWalletTiles(sortedWallets)
        )}
      </div>
    </div>
  );
};

export default DigitalWallets;
