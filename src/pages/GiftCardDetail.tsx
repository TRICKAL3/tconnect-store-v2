import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, CreditCard, Star, Shield, Clock, Gift, CheckCircle } from 'lucide-react';
import { useCart } from '../context/CartContext';

interface GiftCardDetailData {
  id: string;
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  discount?: string;
  image: string;
  description: string;
  detailedDescription: string;
  rating: number;
  inStock: boolean;
  redemptionInstructions: string[];
  features: string[];
  terms: string[];
}

const GiftCardDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { dispatch } = useCart();
  const navigate = useNavigate();
  const [selectedAmount, setSelectedAmount] = useState(1);

  // Mock data - in real app, this would come from API
  const giftCard: GiftCardDetailData = {
    id: id || '1',
    name: 'Amazon Gift Card',
    category: 'Retail',
    price: 50.00,
    originalPrice: 52.50,
    discount: '+5%',
    image: 'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=300&h=180&fit=crop&crop=center',
    description: 'Shop millions of products with Amazon gift cards',
    detailedDescription: 'Amazon Gift Cards are the perfect way to give the gift of choice. Recipients can use the gift card to purchase millions of items across Amazon.com, including electronics, books, clothing, home goods, and more. The gift card never expires and can be used for partial purchases.',
    rating: 4.9,
    inStock: true,
    redemptionInstructions: [
      'Go to Amazon.com and sign in to your account',
      'Click on "Gift Cards" in the account menu',
      'Select "Redeem a Gift Card"',
      'Enter the 14-character claim code from your gift card',
      'Click "Apply to Your Balance"',
      'The gift card amount will be added to your Amazon account balance'
    ],
    features: [
      'Never expires',
      'No fees or hidden charges',
      'Can be used for partial purchases',
      'Works on all Amazon marketplaces',
      'Instant delivery via email',
      'Secure and encrypted'
    ],
    terms: [
      'Gift card cannot be returned or refunded',
      'Cannot be used to purchase other gift cards',
      'Subject to Amazon\'s terms and conditions',
      'Valid only on Amazon.com (US)',
      'Cannot be used for Amazon Prime membership'
    ]
  };

  const addToCart = () => {
    dispatch({
      type: 'ADD_ITEM',
      payload: {
        id: giftCard.id,
        name: giftCard.name,
        price: giftCard.price * selectedAmount,
        category: giftCard.category,
        type: 'giftcard',
        image: giftCard.image,
        quantity: selectedAmount
      }
    });
  };

  const buyNow = () => {
    addToCart();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    navigate('/checkout');
  };

  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link 
          to="/giftcards" 
          className="inline-flex items-center text-neon-blue hover:text-neon-purple transition-colors duration-300 mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Gift Cards
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left Column - Product Info */}
          <div className="space-y-8">
            {/* Product Image and Basic Info */}
            <div className="card-dark p-8 rounded-2xl">
              <div className="text-center mb-8">
                <div className="w-32 h-32 mx-auto mb-6 rounded-lg overflow-hidden">
                  <img 
                    src={giftCard.image} 
                    alt={giftCard.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = `https://via.placeholder.com/128x128/1a1a1a/ffffff?text=${giftCard.name.charAt(0)}`;
                    }}
                  />
                </div>
                <h1 className="text-3xl font-bold text-white mb-4 holographic">
                  {giftCard.name}
                </h1>
                <p className="text-lg text-gray-300 mb-6">
                  {giftCard.description}
                </p>
                
                {/* Rating */}
                <div className="flex items-center justify-center space-x-2 mb-6">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <span className="text-lg font-semibold text-gray-300">{giftCard.rating}</span>
                </div>

                {/* Price */}
                <div className="flex items-center justify-center space-x-4 mb-8">
                  <span className="text-4xl font-bold text-neon-blue">${giftCard.price}</span>
                  {giftCard.originalPrice && (
                    <>
                      <span className="text-2xl text-gray-500 line-through">${giftCard.originalPrice}</span>
                      <span className="bg-neon-green text-white px-3 py-1 rounded-full text-sm font-bold">
                        {giftCard.discount}
                      </span>
                    </>
                  )}
                </div>

                {/* Quantity Selector */}
                <div className="mb-8">
                  <label className="block text-lg font-bold text-white mb-4">
                    Quantity
                  </label>
                  <div className="flex items-center justify-center space-x-4">
                    <button
                      onClick={() => setSelectedAmount(Math.max(1, selectedAmount - 1))}
                      className="w-10 h-10 bg-dark-surface border border-dark-border rounded-lg flex items-center justify-center text-white hover:bg-neon-blue/20 transition-colors duration-300"
                    >
                      -
                    </button>
                    <span className="text-2xl font-bold text-white min-w-[3rem] text-center">
                      {selectedAmount}
                    </span>
                    <button
                      onClick={() => setSelectedAmount(selectedAmount + 1)}
                      className="w-10 h-10 bg-dark-surface border border-dark-border rounded-lg flex items-center justify-center text-white hover:bg-neon-blue/20 transition-colors duration-300"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-gray-400 text-sm mt-2 text-center">
                    Total: ${(giftCard.price * selectedAmount).toFixed(2)}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-4">
                  <button
                    onClick={addToCart}
                    disabled={!giftCard.inStock}
                    className="flex-1 cyber-border text-white py-4 px-6 rounded-xl font-bold transition-all duration-300 hover:scale-105 hover:neon-glow disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ShoppingCart className="w-5 h-5 inline mr-2" />
                    Add to Cart
                  </button>
                  <button
                    onClick={buyNow}
                    disabled={!giftCard.inStock}
                    className="flex-1 btn-cyber text-white py-4 px-6 rounded-xl font-bold transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CreditCard className="w-5 h-5 inline mr-2" />
                    Buy Now
                  </button>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="card-dark p-8 rounded-2xl">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                <Gift className="w-6 h-6 mr-3 text-neon-blue" />
                Features
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {giftCard.features.map((feature, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-neon-green flex-shrink-0" />
                    <span className="text-gray-300">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Details */}
          <div className="space-y-8">
            {/* Detailed Description */}
            <div className="card-dark p-8 rounded-2xl">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                <Shield className="w-6 h-6 mr-3 text-neon-blue" />
                Description
              </h3>
              <p className="text-gray-300 leading-relaxed">
                {giftCard.detailedDescription}
              </p>
            </div>

            {/* Redemption Instructions */}
            <div className="card-dark p-8 rounded-2xl">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                <Clock className="w-6 h-6 mr-3 text-neon-blue" />
                How to Redeem
              </h3>
              <ol className="space-y-4">
                {giftCard.redemptionInstructions.map((step, index) => (
                  <li key={index} className="flex items-start space-x-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-neon-blue text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </span>
                    <span className="text-gray-300">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Terms and Conditions */}
            <div className="card-dark p-8 rounded-2xl">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                <Shield className="w-6 h-6 mr-3 text-neon-blue" />
                Terms & Conditions
              </h3>
              <ul className="space-y-3">
                {giftCard.terms.map((term, index) => (
                  <li key={index} className="flex items-start space-x-3">
                    <span className="text-neon-orange mt-1">•</span>
                    <span className="text-gray-300 text-sm">{term}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GiftCardDetail;
