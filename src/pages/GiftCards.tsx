import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, Filter } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { fetchProducts } from '../lib/api';
import { getMwkAmountFromUsd } from '../utils/rates';

interface GiftCard {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
  description: string;
  rating: number;
  inStock: boolean;
}

const GiftCards: React.FC = () => {
  const { dispatch } = useCart();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');

  const categories = [
    'All', 'Gaming', 'Entertainment', 'Retail & Shopping', 'Software', 'Utilities'
  ];

  const [remote, setRemote] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        console.log('🛍️ [GiftCards] Fetching products...');
        const products = await fetchProducts();
        console.log('✅ [GiftCards] Received products:', products.length);
        
        const cards = products
          .filter(p => p.type === 'giftcard')
          .map<GiftCard>(p => ({
            id: p.id,
            name: p.name,
            category: p.category || 'Retail & Shopping',
            price: p.priceUsd,
            image: p.image || '',
            description: p.description || '',
            rating: 5,
            inStock: p.inStock
          }));
        
        console.log('🎁 [GiftCards] Gift cards after filtering:', cards.length);
        setRemote(cards);
      } catch (e: any) {
        console.error('❌ [GiftCards] Failed to load products:', e);
        setError(e.message || 'Failed to load products');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const giftCards = remote;

  const filteredCards = giftCards.filter(card => {
    const matchesCategory = selectedCategory === 'All' || 
      (selectedCategory === 'Retail & Shopping' && card.category === 'Retail & Shopping') ||
      (selectedCategory !== 'Retail & Shopping' && card.category === selectedCategory);
    const matchesSearch = card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         card.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const sortedCards = [...filteredCards].sort((a, b) => {
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

  const addToCart = (card: GiftCard) => {
    dispatch({
      type: 'ADD_ITEM',
      payload: {
        id: card.id,
        name: card.name,
        price: card.price,
        category: card.category,
        type: 'giftcard',
        image: card.image,
        quantity: 1
      }
    });
  };

  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 holographic">
            Gift Cards
          </h1>
          <p className="text-lg md:text-xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
            Choose from our extensive collection of digital gift cards across all major categories
          </p>
        </div>

        {/* Filters and Search */}
        <div className="card-dark p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
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

            {/* Category Filter */}
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

            {/* Sort */}
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-dark-surface border border-dark-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-neon-blue focus:border-neon-blue text-white"
              >
                <option value="name">Sort by Name</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Rating</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-neon-blue mb-4"></div>
            <p className="text-gray-300">Loading products...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="card-dark p-6 mb-8 text-center">
            <p className="text-red-400 mb-2">❌ Error loading products</p>
            <p className="text-gray-400 text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-neon-blue text-white rounded-lg hover:bg-neon-blue/80 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Results Count */}
        {!loading && !error && (
          <div className="mb-6">
            <p className="text-gray-300">
              Showing {sortedCards.length} of {giftCards.length} gift cards
              {selectedCategory !== 'All' && ` in ${selectedCategory}`}
            </p>
          </div>
        )}

        {/* Empty State */}
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

        {/* Gift Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {sortedCards.map((card) => (
            <div
              key={card.id}
              className="group card-dark rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden border border-dark-border hover:border-neon-blue/50"
            >
              <div className="p-3">
                {/* Gift Card Image - Larger to cover half the card */}
                <div className="w-full h-32 mb-3 group-hover:scale-105 transition-transform duration-300 rounded-lg overflow-hidden">
                  <img 
                    src={card.image} 
                    alt={card.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = `https://via.placeholder.com/160x128/1a1a1a/ffffff?text=${card.name.charAt(0)}`;
                    }}
                  />
                </div>

                {/* Gift Card Name */}
                <h3 className="text-sm font-bold text-white mb-2 group-hover:text-neon-blue transition-colors duration-300 text-center line-clamp-2">
                  {card.name}
                </h3>

                {/* Price and Stock Status */}
                <div className="text-center mb-3">
                  <div className="text-base font-bold text-neon-blue group-hover:text-neon-purple transition-colors duration-300">
                    ${card.price}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    MWK ≈ {getMwkAmountFromUsd(card.price, 'giftcard').toLocaleString()}
                  </div>
                  <div className={`text-xs font-semibold mt-1 ${
                    card.inStock ? 'text-neon-green' : 'text-neon-red'
                  }`}>
                    {card.inStock ? '✓ In Stock' : '✗ Out of Stock'}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <Link 
                    to={`/giftcard/${card.id}`} 
                    className="w-full cyber-border text-white py-2 px-3 rounded-lg text-xs font-bold transition-all duration-300 hover:scale-105 hover:neon-glow text-center block"
                  >
                    View
                  </Link>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => addToCart(card)}
                      disabled={!card.inStock}
                      className={`flex-1 py-2 px-2 rounded-lg font-bold text-xs transition-all duration-300 flex items-center justify-center space-x-1 transform hover:scale-105 ${
                        card.inStock
                          ? 'cyber-border text-white hover:neon-glow'
                          : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <ShoppingCart className="w-3 h-3" />
                      <span className="hidden sm:inline">{card.inStock ? 'Add' : 'Out'}</span>
                    </button>
                    <button
                      onClick={() => {
                        if (!user) { navigate('/signin'); return; }
                        if (card.inStock) {
                          addToCart(card);
                          navigate('/checkout');
                        }
                      }}
                      disabled={!card.inStock}
                      className={`flex-1 py-2 px-2 rounded-lg font-bold text-xs transition-all duration-300 flex items-center justify-center space-x-1 transform hover:scale-105 ${
                        card.inStock
                          ? 'btn-cyber text-white'
                          : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <span>Buy</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {sortedCards.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              No gift cards found
            </h3>
            <p className="text-gray-300">
              Try adjusting your search or filter criteria
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GiftCards;
