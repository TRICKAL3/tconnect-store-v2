import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, CreditCard, Shield, Clock, Gift } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { fetchProductById, type ApiProduct } from '../lib/api';
import { getAbsoluteImageUrl, GIFT_CARD_PLACEHOLDER } from '../lib/getApiBase';
import { getMwkAmountFromUsd } from '../utils/rates';
import {
  clampGiftCardBuyerUsd,
  defaultBuyerAmountFromCatalog,
  buyerCanCheckoutGiftCardUsd,
  GIFTCARD_BUYER_MAX_USD,
} from '../lib/giftCardPricing';

const REDEEM_SEP = '\n\nHow to Redeem:';

const GiftCardDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { dispatch } = useCart();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [amountRaw, setAmountRaw] = useState('25');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!id) {
      setLoadError('Missing product id');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const p = await fetchProductById(id);
        if (cancelled) return;
        if (p.type !== 'giftcard') {
          setLoadError('This product is not a gift card.');
          setProduct(null);
          return;
        }
        setProduct(p);
        setAmountRaw(String(defaultBuyerAmountFromCatalog(p.priceUsd)));
      } catch (e: unknown) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Failed to load product');
          setProduct(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const amountUsd = useMemo(() => clampGiftCardBuyerUsd(parseFloat(amountRaw) || 0), [amountRaw]);

  const { headline, redeemBlock } = useMemo(() => {
    const d = product?.description || '';
    const i = d.indexOf(REDEEM_SEP);
    if (i === -1) return { headline: d.trim(), redeemBlock: '' };
    return {
      headline: d.slice(0, i).trim(),
      redeemBlock: d.slice(i + REDEEM_SEP.length).trim(),
    };
  }, [product?.description]);

  const addToCart = () => {
    if (!product || !product.inStock || !buyerCanCheckoutGiftCardUsd(amountUsd)) return;
    dispatch({
      type: 'ADD_ITEM',
      payload: {
        id: product.id,
        name: product.name,
        price: amountUsd,
        category: product.category || 'Retail & Shopping',
        type: 'giftcard',
        image: product.image,
        quantity,
      },
    });
  };

  const buyNow = () => {
    addToCart();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    navigate('/checkout');
  };

  const lineTotal = amountUsd * quantity;
  const canSubmit = product && product.inStock && buyerCanCheckoutGiftCardUsd(amountUsd);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center px-4">
        <p className="text-gray-300">Loading product…</p>
      </div>
    );
  }

  if (loadError || !product) {
    return (
      <div className="min-h-screen bg-dark-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            to="/giftcards"
            className="inline-flex items-center text-neon-blue hover:text-neon-purple transition-colors duration-300 mb-8"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Gift Cards
          </Link>
          <div className="card-dark p-8 rounded-2xl text-center">
            <p className="text-red-400 mb-2">{loadError || 'Product not found'}</p>
            <Link to="/giftcards" className="text-neon-blue hover:underline">
              Browse gift cards
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const img = getAbsoluteImageUrl(product.image) || GIFT_CARD_PLACEHOLDER;

  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          to="/giftcards"
          className="inline-flex items-center text-neon-blue hover:text-neon-purple transition-colors duration-300 mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Gift Cards
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-8">
            <div className="card-dark p-8 rounded-2xl">
              <div className="text-center mb-8">
                <div className="w-32 h-32 mx-auto mb-6 rounded-lg overflow-hidden">
                  <img
                    src={img}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = GIFT_CARD_PLACEHOLDER;
                    }}
                  />
                </div>
                <h1 className="text-3xl font-bold text-white mb-4 holographic">{product.name}</h1>
                {headline ? (
                  <p className="text-lg text-gray-300 mb-6 text-left whitespace-pre-wrap">{headline}</p>
                ) : (
                  <p className="text-lg text-gray-300 mb-6">Digital gift card — you choose the USD value.</p>
                )}

                <p className="text-sm text-gray-400 mb-6">
                  Enter any amount from <span className="text-white">$0</span> up to{' '}
                  <span className="text-white">${GIFTCARD_BUYER_MAX_USD}</span> per card. Amount must be greater than $0
                  to add to cart.
                </p>

                <div className="text-left max-w-sm mx-auto space-y-4 mb-8">
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">Amount per card (USD)</label>
                    <input
                      type="number"
                      min={0}
                      max={GIFTCARD_BUYER_MAX_USD}
                      step={0.01}
                      value={amountRaw}
                      onChange={(e) => setAmountRaw(e.target.value)}
                      className="w-full px-4 py-3 bg-dark-surface border border-dark-border rounded-lg text-white focus:ring-2 focus:ring-neon-blue"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      MWK ≈ {getMwkAmountFromUsd(amountUsd, 'giftcard').toLocaleString()} (estimate)
                    </p>
                    {!buyerCanCheckoutGiftCardUsd(amountUsd) && (
                      <p className="text-xs text-amber-400 mt-1">Enter an amount greater than $0 and at most $1,000.</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">Number of cards</label>
                    <div className="flex items-center space-x-4">
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="w-10 h-10 bg-dark-surface border border-dark-border rounded-lg flex items-center justify-center text-white hover:bg-neon-blue/20"
                      >
                        −
                      </button>
                      <span className="text-xl font-bold text-white min-w-[3rem] text-center">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => q + 1)}
                        className="w-10 h-10 bg-dark-surface border border-dark-border rounded-lg flex items-center justify-center text-white hover:bg-neon-blue/20"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-neon-blue text-2xl font-bold mb-2">
                  Line total: ${lineTotal.toFixed(2)}{' '}
                  <span className="text-sm font-normal text-gray-400">({quantity}× ${amountUsd.toFixed(2)})</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    type="button"
                    onClick={addToCart}
                    disabled={!canSubmit}
                    className="flex-1 cyber-border text-white py-4 px-6 rounded-xl font-bold transition-all duration-300 hover:scale-105 hover:neon-glow disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ShoppingCart className="w-5 h-5 inline mr-2" />
                    Add to Cart
                  </button>
                  <button
                    type="button"
                    onClick={buyNow}
                    disabled={!canSubmit}
                    className="flex-1 btn-cyber text-white py-4 px-6 rounded-xl font-bold transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CreditCard className="w-5 h-5 inline mr-2" />
                    Buy Now
                  </button>
                </div>

                {!product.inStock && (
                  <p className="mt-4 text-red-400 text-sm">This gift card is currently out of stock.</p>
                )}
              </div>
            </div>

            <div className="card-dark p-8 rounded-2xl">
              <h3 className="text-2xl font-bold text-white mb-4 flex items-center">
                <Gift className="w-6 h-6 mr-3 text-neon-blue" />
                Digital delivery
              </h3>
              <ul className="text-gray-300 space-y-2 text-sm">
                <li>• Codes or instructions delivered after payment confirmation</li>
                <li>• Choose your own USD denomination for each card</li>
              </ul>
            </div>
          </div>

          <div className="space-y-8">
            {redeemBlock ? (
              <div className="card-dark p-8 rounded-2xl">
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                  <Clock className="w-6 h-6 mr-3 text-neon-blue" />
                  How to redeem
                </h3>
                <div className="text-gray-300 leading-relaxed whitespace-pre-wrap text-sm">{redeemBlock}</div>
              </div>
            ) : (
              <div className="card-dark p-8 rounded-2xl">
                <h3 className="text-2xl font-bold text-white mb-4 flex items-center">
                  <Shield className="w-6 h-6 mr-3 text-neon-blue" />
                  Redeem
                </h3>
                <p className="text-gray-300 text-sm">
                  Detailed redemption steps are included with your order confirmation when available from the issuer.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GiftCardDetail;
