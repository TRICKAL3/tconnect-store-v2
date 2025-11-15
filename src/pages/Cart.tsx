import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft, CreditCard, Coins } from 'lucide-react';
import { useCart } from '../context/CartContext';

const Cart: React.FC = () => {
  const { state, dispatch } = useCart();
  const navigate = useNavigate();

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      dispatch({ type: 'REMOVE_ITEM', payload: id });
    } else {
      dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
    }
  };

  const removeItem = (id: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: id });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  const proceedToCheckout = () => {
    navigate('/checkout');
  };

  if (state.items.length === 0) {
    return (
      <div className="min-h-screen bg-dark-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-8 md:py-12">
            <ShoppingBag className="w-16 h-16 md:w-24 md:h-24 text-gray-400 mx-auto mb-4 md:mb-6" />
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-3 md:mb-4 holographic">
              Your cart is empty
            </h1>
            <p className="text-base md:text-xl text-gray-300 mb-6 md:mb-8">
              Looks like you haven't added any items to your cart yet.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
              <Link
                to="/giftcards"
                className="btn-cyber px-6 md:px-8 py-2.5 md:py-3 text-base md:text-lg"
              >
                Browse Gift Cards
              </Link>
              <Link
                to="/crypto"
                className="cyber-border px-6 md:px-8 py-2.5 md:py-3 text-base md:text-lg"
              >
                Buy Cryptocurrency
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg pb-24 md:pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        {/* Mobile App Style Header */}
        <div className="flex items-center justify-between mb-4 md:mb-8 sticky top-0 bg-dark-bg z-10 py-3 md:py-0 md:relative">
          <div className="flex items-center space-x-2 md:space-x-4 flex-1 min-w-0">
            <Link
              to="/"
              className="flex items-center text-gray-300 hover:text-neon-blue transition-colors duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-lg md:text-3xl font-bold text-white holographic truncate">
              Cart ({state.itemCount})
            </h1>
          </div>
          <button
            onClick={clearCart}
            className="text-red-400 hover:text-red-300 font-medium transition-colors duration-200 text-sm md:text-base ml-2"
          >
            Clear
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 order-2 lg:order-1">
            <div className="card-dark rounded-xl md:rounded-2xl overflow-hidden">
              <div className="px-4 md:px-6 py-3 md:py-4 border-b border-dark-border">
                <h2 className="text-base md:text-lg font-semibold text-white">
                  Items in your cart
                </h2>
              </div>
              <div className="divide-y divide-dark-border">
                {state.items.map((item) => (
                  <div key={item.id} className="p-3 md:p-6">
                    <div className="flex items-start space-x-3 md:space-x-4">
                      {/* Item Image */}
                      <div className="flex-shrink-0">
                        {item.image && (item.image.startsWith('http') || item.image.startsWith('/')) ? (
                          <img 
                            src={item.image} 
                            alt={item.name}
                            className="w-14 h-14 md:w-16 md:h-16 rounded-lg object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`w-14 h-14 md:w-16 md:h-16 bg-dark-surface rounded-lg flex items-center justify-center ${item.image && (item.image.startsWith('http') || item.image.startsWith('/')) ? 'hidden' : ''}`}>
                          <span className="text-xl md:text-2xl">{item.name.charAt(0).toUpperCase()}</span>
                        </div>
                      </div>

                      {/* Item Details */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm md:text-lg font-medium text-white truncate">
                          {item.name}
                        </h3>
                        <p className="text-xs md:text-sm text-gray-400">
                          {item.category} • {item.type === 'giftcard' ? 'Gift Card' : 'Cryptocurrency'}
                        </p>
                        <div className="mt-1 md:mt-2 flex items-center space-x-2 md:space-x-4 flex-wrap">
                          <div className="text-sm md:text-lg font-semibold text-neon-blue">
                            ${item.price.toFixed(2)}
                          </div>
                          {item.type === 'crypto' && (
                            <div className="text-xs md:text-sm text-gray-400">
                              per {item.name.split(' ')[0]}
                            </div>
                          )}
                        </div>
                        
                        {/* Mobile: Quantity and Remove in same row */}
                        <div className="mt-2 md:mt-0 flex items-center justify-between md:hidden">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="p-1.5 rounded-full hover:bg-neon-blue/20 active:scale-95 transition-all"
                            >
                              <Minus className="w-4 h-4 text-gray-300" />
                            </button>
                            <span className="w-10 text-center font-medium text-white text-sm">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="p-1.5 rounded-full hover:bg-neon-blue/20 active:scale-95 transition-all"
                            >
                              <Plus className="w-4 h-4 text-gray-300" />
                            </button>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="text-base font-semibold text-white">
                              ${(item.price * item.quantity).toFixed(2)}
                            </div>
                            <button
                              onClick={() => removeItem(item.id)}
                              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-full active:scale-95 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Desktop: Quantity Controls */}
                      <div className="hidden md:flex items-center space-x-2">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="p-1 rounded-full hover:bg-neon-blue/20 transition-colors duration-200"
                        >
                          <Minus className="w-4 h-4 text-gray-300" />
                        </button>
                        <span className="w-12 text-center font-medium text-white">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="p-1 rounded-full hover:bg-neon-blue/20 transition-colors duration-200"
                        >
                          <Plus className="w-4 h-4 text-gray-300" />
                        </button>
                      </div>

                      {/* Desktop: Item Total */}
                      <div className="hidden md:block text-right">
                        <div className="text-lg font-semibold text-white">
                          ${(item.price * item.quantity).toFixed(2)}
                        </div>
                      </div>

                      {/* Desktop: Remove Button */}
                      <button
                        onClick={() => removeItem(item.id)}
                        className="hidden md:block p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-full transition-colors duration-200"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1 order-1 lg:order-2">
            <div className="card-dark p-4 md:p-6 rounded-xl md:rounded-2xl md:sticky md:top-8">
              <h2 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4">
                Order Summary
              </h2>

              <div className="space-y-2 md:space-y-3 mb-4 md:mb-6">
                <div className="flex justify-between text-xs md:text-sm">
                  <span className="text-gray-400">Subtotal</span>
                  <span className="font-medium text-white">${state.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs md:text-sm">
                  <span className="text-gray-400">Processing Fee</span>
                  <span className="font-medium text-white">$0.00</span>
                </div>
                <div className="flex justify-between text-xs md:text-sm">
                  <span className="text-gray-400">Tax</span>
                  <span className="font-medium text-white">$0.00</span>
                </div>
                <div className="border-t border-dark-border pt-2 md:pt-3">
                  <div className="flex justify-between text-base md:text-lg font-semibold">
                    <span className="text-white">Total</span>
                    <span className="text-neon-blue">${state.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Desktop: Buttons */}
              <div className="hidden md:block space-y-3">
                <button
                  onClick={proceedToCheckout}
                  className="w-full btn-cyber text-white font-medium py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center space-x-2 hover:scale-105"
                >
                  <CreditCard className="w-5 h-5" />
                  <span>Proceed to Checkout</span>
                </button>

                <button className="w-full cyber-border text-white font-medium py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center space-x-2 hover:neon-glow">
                  <Coins className="w-5 h-5" />
                  <span>Pay with Crypto</span>
                </button>
              </div>

              <div className="hidden md:block mt-6 text-center">
                <p className="text-xs md:text-sm text-gray-400">
                  Secure checkout with 256-bit SSL encryption
                </p>
              </div>
            </div>

            {/* Security Features - Desktop Only */}
            <div className="hidden md:block mt-4 md:mt-6 bg-neon-green/10 border border-neon-green/30 rounded-lg p-3 md:p-4">
              <h3 className="text-xs md:text-sm font-semibold text-neon-green mb-2">
                Security Features
              </h3>
              <ul className="text-xs md:text-sm text-gray-300 space-y-1">
                <li>• 256-bit SSL encryption</li>
                <li>• Secure payment processing</li>
                <li>• Instant digital delivery</li>
                <li>• 24/7 customer support</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Mobile: Sticky Bottom Checkout Button */}
        <div className="block md:hidden fixed bottom-0 left-0 right-0 bg-dark-bg border-t border-dark-border p-4 z-50 safe-area-inset-bottom">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Total:</span>
              <span className="text-lg font-bold text-neon-blue">${state.total.toFixed(2)}</span>
            </div>
            <button
              onClick={proceedToCheckout}
              className="w-full btn-cyber text-white font-medium py-3.5 px-4 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2 active:scale-95"
            >
              <CreditCard className="w-5 h-5" />
              <span>Proceed to Checkout</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;