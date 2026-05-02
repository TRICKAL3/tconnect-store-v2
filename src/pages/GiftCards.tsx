import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, Filter, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { fetchProducts } from '../lib/api';
import { getAbsoluteImageUrl, GIFT_CARD_PLACEHOLDER } from '../lib/getApiBase';
import {
  GIFTCARD_BUYER_MAX_USD,
  buyerCanCheckoutGiftCardUsd,
  clampGiftCardBuyerUsd,
  defaultBuyerAmountFromCatalog,
} from '../lib/giftCardPricing';
import { getMwkAmountFromUsd } from '../utils/rates';

interface GiftCard {
  id: string;
  name: string;
  category: string;
  image: string;
  description: string;
  rating: number;
  inStock: boolean;
  priceUsd: number;
}

const GiftCards: React.FC = () => {
  const { dispatch } = useCart();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');

  const [modalCard, setModalCard] = useState<GiftCard | null>(null);
  const [modalMode, setModalMode] = useState<'cart' | 'buy' | null>(null);
  const [amountRaw, setAmountRaw] = useState('25');
  const [giftQty, setGiftQty] = useState(1);

  const categories = [
    'All',
    'Gaming',
    'Entertainment',
    'Retail & Shopping',
    'Software',
    'Utilities',
  ];

  const [remote, setRemote] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const openModal = (card: GiftCard, mode: 'cart' | 'buy') => {
    setModalCard(card);
    setModalMode(mode);
    setAmountRaw(String(defaultBuyerAmountFromCatalog(card.priceUsd)));
    setGiftQty(1);
  };

  const closeModal = () => {
    setModalCard(null);
    setModalMode(null);
  };

  const submitModal = () => {
    if (!modalCard || !modalMode || !modalCard.inStock) return;

    const mode = modalMode;
    const card = modalCard;

    if (mode === 'buy') {
      if (!user) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        navigate('/signin');
        closeModal();
        return;
      }
    }

    const amountUsd = clampGiftCardBuyerUsd(parseFloat(amountRaw) || 0);
    if (!buyerCanCheckoutGiftCardUsd(amountUsd)) return;

    dispatch({
      type: 'ADD_ITEM',
      payload: {
        id: card.id,
        name: card.name,
        price: amountUsd,
        category: card.category,
        type: 'giftcard',
        image: card.image,
        quantity: giftQty,
      },
    });

    closeModal();

    if (mode === 'buy') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      navigate('/checkout');
    }
  };

  const amt = modalCard ? clampGiftCardBuyerUsd(parseFloat(amountRaw) || 0) : 0;

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const products = await fetchProducts();
        const cards = products
          .filter((p) => p.type === 'giftcard')
          .map<GiftCard>((p) => ({
            id: p.id,
            name: p.name,
            category: p.category || 'Retail & Shopping',
            image: p.image || '',
            description: p.description || '',
            rating: 5,
            inStock: p.inStock,
            priceUsd: p.priceUsd,
          }));
        setRemote(cards);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load products');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const giftCards = remote;

  const filteredCards = giftCards.filter((card) => {
    const matchesCategory =
      selectedCategory === 'All' ||
      (selectedCategory === 'Retail & Shopping' && card.category === 'Retail & Shopping') ||
      (selectedCategory !== 'Retail & Shopping' && card.category === selectedCategory);
    const matchesSearch =
      card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const sortedCards = [...filteredCards].sort((a, b) => {
    switch (sortBy) {
      case 'rating':
        return b.rating - a.rating;
      case 'name':
      default:
        return a.name.localeCompare(b.name);
    }
  });

  return (
    <div className="min-h-screen bg-dark-bg">
      {modalCard && modalMode && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gc-modal-title"
        >
          <div className="card-dark rounded-2xl max-w-md w-full p-6 border border-dark-border shadow-xl relative">
            <button
              type="button"
              onClick={closeModal}
              className="absolute top-3 right-3 p-2 rounded-lg hover:bg-dark-surface text-gray-400"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 id="gc-modal-title" className="text-lg font-bold text-white mb-2 pr-10">
              {modalCard.name}
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              Enter USD amount (${0}–${GIFTCARD_BUYER_MAX_USD}) per card. Amount must be greater than $0.
            </p>
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Amount per card (USD)
                </label>
                <input
                  type="number"
                  min={0}
                  max={GIFTCARD_BUYER_MAX_USD}
                  step={0.01}
                  value={amountRaw}
                  onChange={(e) => setAmountRaw(e.target.value)}
                  className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-white focus:ring-2 focus:ring-neon-blue"
                />
                <p className="text-xs text-gray-500 mt-1">
                  MWK ≈ {getMwkAmountFromUsd(amt, 'giftcard').toLocaleString()}
                </p>
                {!buyerCanCheckoutGiftCardUsd(amt) && (
                  <p className="text-xs text-amber-400 mt-1">Enter amount &gt; $0 up to ${GIFTCARD_BUYER_MAX_USD}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Quantity</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setGiftQty((q) => Math.max(1, q - 1))}
                    className="w-10 h-10 rounded-lg bg-dark-surface border border-dark-border text-white"
                  >
                    −
                  </button>
                  <span className="text-white font-bold w-10 text-center">{giftQty}</span>
                  <button
                    type="button"
                    onClick={() => setGiftQty((q) => q + 1)}
                    className="w-10 h-10 rounded-lg bg-dark-surface border border-dark-border text-white"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="text-neon-blue font-semibold">
                Total: ${(amt * giftQty).toFixed(2)}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 py-2.5 rounded-lg border border-dark-border text-gray-300 hover:bg-dark-surface"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitModal}
                disabled={!buyerCanCheckoutGiftCardUsd(amt)}
                className="flex-1 py-2.5 rounded-lg btn-cyber text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {modalMode === 'buy' ? 'Buy now' : 'Add to cart'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 md:mb-10 text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 md:mb-4 holographic">
            Gift Cards
          </h1>
          <p className="text-sm md:text-base text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Choose amount when you add to cart or buy now (up to ${GIFTCARD_BUYER_MAX_USD} USD per card).
          </p>
        </div>

        <div className="card-dark p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search gift cards..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-dark-surface border border-dark-border rounded-lg focus:ring-2 focus:ring-neon-blue focus:border-neon-blue text-white placeholder-gray-400"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                    selectedCategory === category
                      ? 'bg-neon-blue text-white neon-glow'
                      : 'bg-dark-surface text-gray-300 hover:bg-neon-blue/20 border border-dark-border'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-dark-surface border border-dark-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-neon-blue focus:border-neon-blue text-white"
              >
                <option value="name">Sort by Name</option>
                <option value="rating">Rating</option>
              </select>
            </div>
          </div>
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-neon-blue mb-4"></div>
            <p className="text-gray-300">Loading products...</p>
          </div>
        )}

        {error && !loading && (
          <div className="card-dark p-6 mb-8 text-center">
            <p className="text-red-400 mb-2">Error loading products</p>
            <p className="text-gray-400 text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-neon-blue text-white rounded-lg hover:bg-neon-blue/80 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="mb-6">
            <p className="text-gray-300">
              Showing {sortedCards.length} of {giftCards.length} gift cards
              {selectedCategory !== 'All' && ` in ${selectedCategory}`}
            </p>
          </div>
        )}

        {!loading && !error && sortedCards.length === 0 && (
          <div className="card-dark p-12 text-center">
            <p className="text-gray-400 text-lg mb-2">No gift cards found</p>
            <p className="text-gray-500 text-sm">
              {giftCards.length === 0
                ? 'No products available. Please add products in the admin panel.'
                : 'Try adjusting your filters or search term.'}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
          {sortedCards.map((card) => (
            <div
              key={card.id}
              className="group card-dark rounded-lg md:rounded-xl overflow-hidden border border-dark-border hover:border-neon-blue/50 active:scale-[0.98] md:hover:-translate-y-0.5"
            >
              <div className="p-2 sm:p-3">
                <div className="w-full h-20 sm:h-24 md:h-28 mb-2 rounded-md overflow-hidden">
                  <img
                    src={getAbsoluteImageUrl(card.image) || GIFT_CARD_PLACEHOLDER}
                    alt={card.name}
                    className="w-full h-full object-cover group-hover:scale-105"
                    onError={(e) => {
                      e.currentTarget.src = GIFT_CARD_PLACEHOLDER;
                    }}
                  />
                </div>

                <h3 className="text-xs sm:text-sm font-bold text-white mb-1 text-center line-clamp-2 group-hover:text-neon-blue">
                  {card.name}
                </h3>

                <div className="text-center mb-2">
                  <div className="text-xs sm:text-sm font-semibold text-neon-blue">
                    You choose · $0–${GIFTCARD_BUYER_MAX_USD}
                  </div>
                  <div
                    className={`text-[10px] sm:text-xs font-semibold mt-0.5 ${
                      card.inStock ? 'text-neon-green' : 'text-neon-red'
                    }`}
                  >
                    {card.inStock ? '✓ In Stock' : '✗ Out'}
                  </div>
                </div>

                <div className="space-y-1">
                  <Link
                    to={`/giftcard/${card.id}`}
                    className="w-full cyber-border text-white py-1.5 px-2 rounded-md text-[10px] sm:text-xs font-bold text-center block"
                  >
                    View
                  </Link>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => openModal(card, 'cart')}
                      disabled={!card.inStock}
                      className={`flex-1 py-1.5 px-1 rounded-md font-bold text-[10px] sm:text-xs flex items-center justify-center ${
                        card.inStock
                          ? 'cyber-border text-white'
                          : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <ShoppingCart className="w-3 h-3 sm:mr-0.5" />
                      <span className="hidden sm:inline">{card.inStock ? 'Add' : 'Out'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openModal(card, 'buy')}
                      disabled={!card.inStock}
                      className={`flex-1 py-1.5 px-1 rounded-md font-bold text-[10px] sm:text-xs ${
                        card.inStock
                          ? 'btn-cyber text-white'
                          : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      Buy
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GiftCards;
