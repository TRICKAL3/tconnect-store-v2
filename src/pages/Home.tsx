import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Gift, Shield, Zap, CreditCard, TrendingUp, CheckCircle, Globe, ChevronLeft, ChevronRight } from 'lucide-react';
import { getApiBase, getAbsoluteImageUrl, GIFT_CARD_PLACEHOLDER } from '../lib/getApiBase';
import { GIFTCARD_BUYER_MAX_USD } from '../lib/giftCardPricing';
import paypalLogo from '../assets/paypal.jpg';
import skrillLogo from '../assets/skrill.jpg';
import netellerLogo from '../assets/neteller.jpg';
import perfectMoneyLogo from '../assets/perfect-money.jpg';

// Dark AI-generated cartoon/icon slides
const sampleSlides = [
  {
    id: 'sample-1',
    title: 'Exclusive Rewards!',
    subtitle: 'Bonus Points & Cashback',
    description: 'Earn rewards on every purchase and unlock special bonuses',
    image: '🏆', // Trophy for rewards
    cta: 'Claim Rewards',
    ctaLink: '/giftcards',
    active: true
  },
  {
    id: 'sample-2',
    title: 'Gaming Gift Cards',
    subtitle: 'Level Up Your Game',
    description: 'Steam, PlayStation, Xbox, Nintendo and more gaming platforms',
    image: '🎮', // Game controller
    cta: 'Shop Gaming',
    ctaLink: '/giftcards',
    active: true
  },
  {
    id: 'sample-3',
    title: 'Software & Apps',
    subtitle: 'Digital Tools & Services',
    description: 'Get premium software, apps, and digital services instantly',
    image: '💻', // Laptop/software
    cta: 'Browse Software',
    ctaLink: '/giftcards',
    active: true
  },
  {
    id: 'sample-4',
    title: 'Premium Gift Cards',
    subtitle: 'Instant Digital Delivery',
    description: 'Shop thousands of gift cards from top brands worldwide',
    image: '🎁', // Gift box
    cta: 'Shop Now',
    ctaLink: '/giftcards',
    active: true
  },
  {
    id: 'sample-5',
    title: 'Crypto Trading',
    subtitle: 'Secure & Fast Transactions',
    description: 'Buy and sell cryptocurrencies with the best rates',
    image: '₿', // Bitcoin icon
    cta: 'Explore Crypto',
    ctaLink: '/crypto',
    active: true
  }
];

const HERO_WORDS = ['Gift Cards', 'Crypto', 'Software'];

const Home: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState<any[]>([]);
  const navigate = useNavigate();
  const [visibleElements, setVisibleElements] = useState<Set<string>>(new Set());
  const [heroWordIndex, setHeroWordIndex] = useState(0);

  // Use default slides and append active promotions
  useEffect(() => {
    const loadSlides = async () => {
      const fallback = [...sampleSlides];
      try {
        const API_BASE = getApiBase();
        const res = await fetch(`${API_BASE}/promotions`);
        if (!res.ok) {
          setSlides(fallback);
          return;
        }
        const promotions = await res.json();
        if (!Array.isArray(promotions) || promotions.length === 0) {
          setSlides(fallback);
          return;
        }
        const promoSlides = promotions.slice(0, 5).map((promo: any, idx: number) => {
          const discountText = promo.discountPercent
            ? `${promo.discountPercent}% OFF`
            : promo.discountUsd
            ? `$${Number(promo.discountUsd).toFixed(0)} OFF`
            : 'SPECIAL OFFER';
          return {
            id: `promo-${promo.id || idx}`,
            title: discountText,
            subtitle: promo.name || 'Limited time promotion',
            description: promo.description || 'Save now on selected products.',
            image: '🔥',
            cta: 'Shop Promo',
            ctaLink: '/giftcards',
            active: true,
          };
        });
        setSlides([...promoSlides, ...fallback]);
      } catch {
        setSlides(fallback);
      }
    };
    loadSlides();
  }, []);

  // Rotate hero keywords (gift cards, crypto, software)
  useEffect(() => {
    const interval = setInterval(() => {
      setHeroWordIndex((prev) => (prev + 1) % HERO_WORDS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  // Intersection Observer for scroll animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleElements((prev) => new Set(prev).add(entry.target.id));
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    const elements = document.querySelectorAll('.fade-in-on-scroll');
    elements.forEach((el) => observer.observe(el));
    return () => elements.forEach((el) => observer.unobserve(el));
  }, []);

  const categories = [
    { 
      name: 'Gaming', 
      icon: '🎮', 
      description: 'Gift cards for gaming platforms and in-game purchases',
      link: '/giftcards',
      color: 'neon-purple'
    },
    { 
      name: 'Entertainment', 
      icon: '🎬', 
      description: 'Streaming, music, and entertainment gift cards',
      link: '/giftcards',
      color: 'neon-red'
    },
    { 
      name: 'Retail & Shopping', 
      icon: '🛍️', 
      description: 'Gift cards for online shopping and retail stores',
      link: '/giftcards',
      color: 'neon-blue'
    },
    { 
      name: 'Software', 
      icon: '💻', 
      description: 'Gift cards for software, apps, and digital tools',
      link: '/giftcards',
      color: 'neon-green'
    },
    { 
      name: 'Utilities', 
      icon: '⚡', 
      description: 'Gift cards for everyday services and utilities',
      link: '/giftcards',
      color: 'neon-orange'
    }
  ];

  const [featuredCards, setFeaturedCards] = useState<any[]>([]);

  const [popularCards, setPopularCards] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  
  useEffect(() => {
    const loadProducts = async () => {
      setProductsLoading(true);
      try {
        const API_BASE = getApiBase();
        console.log('📤 [Home] Fetching products from:', `${API_BASE}/products`);
        
        const res = await fetch(`${API_BASE}/products`);
        console.log('📥 [Home] Products response status:', res.status);
        
        if (!res.ok) {
          throw new Error(`Failed to fetch products: ${res.status} ${res.statusText}`);
        }
        
        const prods = await res.json();
        console.log('✅ [Home] Products loaded:', prods.length, 'total products');
        
        const featured = prods.filter((p: any) => p.type === 'giftcard' && p.featured);
        const popular = prods.filter((p: any) => p.type === 'giftcard' && p.popular);
        
        console.log('📊 [Home] Featured cards:', featured.length, 'Popular cards:', popular.length);
        
        setFeaturedCards(featured.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          priceLabel: `You choose · $0–${GIFTCARD_BUYER_MAX_USD}`,
          image: p.image,
          badge: 'Featured',
          badgeColor: 'bg-neon-blue',
        })));
        setPopularCards(
          popular.map((p: any) => ({
            id: p.id,
            name: p.name,
            priceLabel: `You choose · $0–${GIFTCARD_BUYER_MAX_USD}`,
            originalPrice: '',
            discount: '',
            image: p.image,
            rating: 5,
          }))
        );
      } catch (error: any) {
        console.error('❌ [Home] Failed to load products:', error);
        // Set empty arrays on error so UI doesn't break
        setFeaturedCards([]);
        setPopularCards([]);
      } finally {
        setProductsLoading(false);
      }
    };
    
    loadProducts();
  }, []);

  const cryptoCoins = [
    { id: 1, name: 'USDT', symbol: 'USDT', image: '₮', description: 'Tether USD - Stable coin', inStock: true },
    { id: 2, name: 'USDC', symbol: 'USDC', image: '🪙', description: 'USD Coin - Stable coin', inStock: true },
    { id: 3, name: 'BUSD', symbol: 'BUSD', image: '🟡', description: 'Binance USD - Stable coin', inStock: true },
    { id: 4, name: 'BTC', symbol: 'BTC', image: '₿', description: 'Bitcoin', inStock: true },
    { id: 5, name: 'ETH', symbol: 'ETH', image: '♦', description: 'Ethereum', inStock: true }
  ];

  const walletServices = [
    {
      id: 1,
      name: 'PayPal',
      description: 'Send and receive money globally',
      image: paypalLogo,
      badge: 'Popular',
      badgeColor: 'bg-neon-blue'
    },
    {
      id: 2,
      name: 'Skrill',
      description: 'Digital wallet for online payments',
      image: skrillLogo,
      badge: 'Trusted',
      badgeColor: 'bg-neon-green'
    },
    {
      id: 3,
      name: 'Neteller',
      description: 'Secure money transfers worldwide',
      image: netellerLogo,
      badge: 'Fast',
      badgeColor: 'bg-neon-purple'
    },
    {
      id: 4,
      name: 'Perfect Money',
      description: 'Instant payment system',
      image: perfectMoneyLogo,
      badge: 'Secure',
      badgeColor: 'bg-neon-orange'
    }
  ];

  const virtualCards = [
    {
      id: 1,
      name: 'Virtual Visa',
      description: 'Prepaid virtual cards for online shopping',
      image: '💳'
    },
    {
      id: 2,
      name: 'Virtual Mastercard',
      description: 'Secure virtual cards accepted worldwide',
      image: '💎'
    },
    {
      id: 3,
      name: 'Prepaid Cards',
      description: 'Load and spend with prepaid virtual cards',
      image: '🔄'
    }
  ];

  const howItWorks = [
    {
      step: 1,
      title: 'Choose Your Gift Card',
      description: 'Browse our selection of premium gift cards from top brands.',
      icon: <Gift className="w-8 h-8" />
    },
    {
      step: 2,
      title: 'Secure Checkout',
      description: 'Pay securely using your preferred payment method.',
      icon: <Shield className="w-8 h-8" />
    },
    {
      step: 3,
      title: 'Instant Delivery',
      description: 'Receive your digital gift card instantly via email.',
      icon: <Zap className="w-8 h-8" />
    },
    {
      step: 4,
      title: 'Ready to Use',
      description: 'Use your gift card online or in-store at your convenience.',
      icon: <CheckCircle className="w-8 h-8" />
    }
  ];

  
  
  // Auto-play slideshow
  useEffect(() => {
    if (slides.length === 0) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [slides.length]);

  

  return (
    <div className="min-h-screen bg-dark-bg">
      
      {/* Hero Section with Slogan and Slideshow */}
      <section className="relative py-12 md:py-16 lg:py-20 bg-dark-gradient text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 lg:gap-12 items-center">
            {/* Static Slogan & Description - Left Side */}
            <div className="space-y-4 md:space-y-6 text-center md:text-left order-2 md:order-1">
              <div className="space-y-2 md:space-y-3">
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-white">
                  Premium Gift Cards
                </h1>
                <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-light text-neon-blue">
                  Your One-Stop Digital Store for{' '}
                  <span className="hero-word-wrapper">
                    <span
                      key={HERO_WORDS[heroWordIndex]}
                      className="hero-word font-semibold"
                    >
                      {HERO_WORDS[heroWordIndex]}
                    </span>
                  </span>
                </h2>
                <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-300 max-w-xl mx-auto md:mx-0 leading-relaxed">
                  Discover premium gift cards, leading cryptocurrencies, and top software licenses in one secure digital store.
                  Easy to purchase, instant to deliver, and perfect for every occasion.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center md:justify-start">
                <Link
                  to="/giftcards"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-2.5 md:px-8 md:py-3 rounded-lg font-semibold text-sm md:text-base active:scale-95 hover:scale-105 flex items-center justify-center shadow-lg hover:shadow-xl transition-all w-auto mx-auto sm:mx-0 border border-blue-400/50"
                >
                  Start Shopping
                  <ArrowRight className="ml-2 w-4 h-4 md:w-5 md:h-5" />
                </Link>
              </div>
            </div>
            
            {/* Promotional Slideshow - Right Corner */}
            <div className="flex justify-center md:justify-end order-1 md:order-2">
              <div className="relative w-full max-w-md group">
                {slides.length > 0 ? (
                  <>
                    <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                      {/* Navigation Arrows */}
                      {slides.length > 1 && (
                        <>
                          <button
                            onClick={() => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)}
                            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-12 md:h-12 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all duration-300 opacity-0 group-hover:opacity-100 active:scale-95"
                            aria-label="Previous slide"
                          >
                            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
                          </button>
                          <button
                            onClick={() => setCurrentSlide((prev) => (prev + 1) % slides.length)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-12 md:h-12 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all duration-300 opacity-0 group-hover:opacity-100 active:scale-95"
                            aria-label="Next slide"
                          >
                            <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
                          </button>
                        </>
                      )}
                      
                      {/* Slides Container */}
                      <div className="relative h-64 sm:h-72 md:h-80 lg:h-96 overflow-hidden">
                        {slides.map((slide, index) => (
                          <div
                            key={slide.id}
                            className={`absolute inset-0 transition-all duration-700 ease-in-out ${
                              index === currentSlide 
                                ? 'opacity-100 translate-x-0 z-10' 
                                : index < currentSlide
                                ? 'opacity-0 -translate-x-full z-0'
                                : 'opacity-0 translate-x-full z-0'
                            }`}
                          >
                            {/* Dark AI-generated cartoon/icon background */}
                            <div className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center relative overflow-hidden">
                              {/* Dark pattern overlay */}
                              <div className="absolute inset-0 opacity-20" style={{
                                backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.1) 1px, transparent 0)',
                                backgroundSize: '40px 40px'
                              }}></div>
                              
                              {/* Large dark icon/cartoon */}
                              <div className="text-8xl sm:text-9xl md:text-[12rem] lg:text-[14rem] filter drop-shadow-2xl z-10 relative">
                                {slide.image}
                              </div>
                              
                              {/* Gradient Overlay for better text readability */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
                              
                              {/* Title overlay - Top Left */}
                              {slide.title && (
                                <div className="absolute top-4 left-4 z-20">
                                  <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white drop-shadow-2xl animate-fade-in">
                                    {slide.title}
                                  </h3>
                                  {slide.subtitle && (
                                    <p className="text-sm sm:text-base md:text-lg text-yellow-400 drop-shadow-2xl mt-1 animate-fade-in-delay font-semibold">
                                      {slide.subtitle}
                                    </p>
                                  )}
                                  {slide.description && (
                                    <p className="text-xs sm:text-sm text-gray-300 drop-shadow-lg mt-2 max-w-xs hidden sm:block">
                                      {slide.description}
                                    </p>
                                  )}
                                </div>
                              )}
                              {/* CTA Button - Bottom Right */}
                              {slide.cta && slide.ctaLink && (
                                <div className="absolute bottom-4 right-4 z-20">
                                  <Link
                                    to={slide.ctaLink}
                                    className="inline-block bg-green-500 hover:bg-green-600 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-bold text-sm md:text-base shadow-2xl hover:shadow-green-500/50 transition-all active:scale-95 border-2 border-yellow-400 transform hover:scale-105"
                                  >
                                    {slide.cta}
                                  </Link>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Enhanced Slideshow indicator */}
                    {slides.length > 1 && (
                      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 z-10">
                        <div className="flex space-x-2 bg-black/30 backdrop-blur-sm px-3 py-2 rounded-full">
                          {slides.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={() => setCurrentSlide(idx)}
                              className={`transition-all duration-300 active:scale-125 ${
                                idx === currentSlide 
                                  ? 'w-8 h-2.5 md:w-10 md:h-3 bg-neon-blue neon-glow rounded-full' 
                                  : 'w-2.5 h-2.5 md:w-3 md:h-3 bg-gray-500 hover:bg-gray-400 rounded-full'
                              }`}
                              aria-label={`Go to slide ${idx + 1}`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                    <img 
                      src="https://images.unsplash.com/photo-1607082349566-187342175e2f?w=800&h=600&fit=crop" 
                      alt="No promotions" 
                      className="w-full h-64 sm:h-72 md:h-80 lg:h-96 object-cover"
                    />
                    <div className="absolute bottom-4 right-4">
                      <p className="text-white text-sm bg-black/50 px-3 py-2 rounded">No promotions available</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="py-4 bg-dark-bg/80 border-y border-dark-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-6 md:gap-10 text-sm text-gray-300">
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-neon-green" />
              200+ users registered
            </span>
            <span className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-neon-purple" />
              1000+ orders processed
            </span>
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Instant delivery
            </span>
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-neon-green" />
              Secure payment
            </span>
            <span className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-neon-blue" />
              Worldwide
            </span>
            <a href="#how-it-works" className="flex items-center gap-2 text-neon-blue hover:text-white transition-colors">
              How it works
            </a>
            <a href="#featured" className="flex items-center gap-2 text-neon-blue hover:text-white transition-colors">
              Featured cards
            </a>
          </div>
        </div>
      </section>

      {/* How It Works - early for trust */}
      <section id="how-it-works" className="py-12 md:py-16 bg-dark-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 md:mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 holographic">
              How It Works
            </h2>
            <p className="text-base text-gray-300 max-w-2xl mx-auto">
              Getting your favorite gift cards has never been easier
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
            {howItWorks.map((step, index) => (
              <div key={step.step} className="text-center card-dark p-4 md:p-6 rounded-xl md:rounded-2xl border border-dark-border hover:border-neon-blue/50">
                <div className="relative inline-flex mb-3">
                  <div className="w-12 h-12 md:w-14 md:h-14 bg-neon-blue/20 rounded-lg md:rounded-xl flex items-center justify-center text-neon-blue">
                    {step.icon}
                  </div>
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 md:w-6 md:h-6 bg-neon-blue rounded-full flex items-center justify-center text-white font-bold text-[10px] md:text-xs">
                    {step.step}
                  </span>
                </div>
                <h3 className="text-base md:text-lg font-bold text-white mb-1 md:mb-2">{step.title}</h3>
                <p className="text-gray-300 text-xs md:text-sm leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Shop by Category Section */}
      <section id="categories" className="py-12 md:py-20 bg-dark-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`text-center mb-8 md:mb-16 fade-in-on-scroll ${visibleElements.has('category-header') ? 'visible' : ''}`} id="category-header">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-3 md:mb-4 holographic">
              Shop by Category
            </h2>
            <p className="text-sm md:text-base text-gray-300 max-w-2xl mx-auto">
              Find the perfect gift card for any occasion
            </p>
            <Link to="/giftcards" className="inline-flex items-center text-neon-blue hover:text-neon-purple transition-colors duration-300 mt-3 md:mt-4 text-sm md:text-base">
              Browse all Products
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-6">
            {categories.map((category, index) => (
              <Link
                key={category.name}
                to={category.link}
                id={`category-${index}`}
                className={`group card-dark p-3 md:p-6 rounded-lg md:rounded-xl hover:border-neon-blue/50 active:scale-[0.98] md:hover:-translate-y-1 fade-in-on-scroll ${visibleElements.has(`category-${index}`) ? 'visible' : ''}`}
              >
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl md:text-5xl mb-2 md:mb-3 group-hover:scale-105">
                    {category.icon}
                  </div>
                  <h3 className="text-sm md:text-lg font-bold text-white mb-1 md:mb-2 group-hover:text-neon-blue">
                    {category.name}
                  </h3>
                  <p className="text-[10px] sm:text-xs md:text-sm text-gray-300 mb-2 md:mb-3 leading-relaxed line-clamp-2">
                    {category.description}
                  </p>
                  <div className="flex items-center justify-center text-neon-blue group-hover:text-neon-purple">
                    <span className="text-[10px] sm:text-xs font-semibold">Explore</span>
                    <ArrowRight className="ml-1 w-3 h-3" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Gift Cards Section */}
      <section id="featured" className="py-12 md:py-20 bg-dark-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 md:mb-16">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-3 md:mb-4 holographic">
              Featured Gift Cards
            </h2>
            <p className="text-sm md:text-base text-gray-300 max-w-2xl mx-auto">
              Our most popular and trusted gift cards
            </p>
          </div>

          {productsLoading ? (
            <div className="text-center py-12">
              <div className="text-gray-400">Loading products...</div>
            </div>
          ) : featuredCards.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No featured products available at the moment.</p>
              <Link to="/giftcards" className="inline-block mt-4 text-neon-blue hover:text-neon-purple transition-colors">
                Browse all products
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
              {featuredCards.map((card) => (
              <Link
                key={card.id}
                to={`/giftcard/${card.id}`}
                className="group card-dark rounded-lg md:rounded-xl overflow-hidden border border-dark-border hover:border-neon-blue/50 active:scale-[0.98] md:hover:-translate-y-0.5"
              >
                <div className="p-2 sm:p-3 md:p-4">
                  <div className="relative">
                    <div className={`absolute top-0 right-0 px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-bold text-white ${card.badgeColor}`}>
                      {card.badge}
                    </div>
                    <div className="text-center">
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
                      <h3 className="text-xs sm:text-sm font-bold text-white mb-1 line-clamp-2 group-hover:text-neon-blue">
                        {card.name}
                      </h3>
                      <div className="text-xs sm:text-sm md:text-base font-semibold text-neon-blue leading-tight">
                        {card.priceLabel}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Most Popular Gift Cards Section */}
      <section id="popular" className="py-12 md:py-20 bg-dark-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 md:mb-16 gap-4">
            <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2 md:mb-4 holographic">
              Most Popular Gift Cards
            </h2>
            <p className="text-sm md:text-base text-gray-300">
                Top picks from our customers this week
              </p>
            </div>
            <Link to="/giftcards" className="text-neon-blue hover:text-neon-purple transition-colors duration-300 font-semibold text-sm md:text-base">
              View All
            </Link>
          </div>

          {productsLoading ? (
            <div className="text-center py-12">
              <div className="text-gray-400">Loading products...</div>
            </div>
          ) : popularCards.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No popular products available at the moment.</p>
              <Link to="/giftcards" className="inline-block mt-4 text-neon-blue hover:text-neon-purple transition-colors">
                Browse all products
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
              {popularCards.map((card) => (
              <Link
                key={card.id}
                to={`/giftcard/${card.id}`}
                className="group card-dark rounded-lg md:rounded-xl overflow-hidden border border-dark-border hover:border-neon-blue/50 active:scale-[0.98] md:hover:-translate-y-0.5"
              >
                <div className="p-2 sm:p-3 md:p-4">
                  <div className="text-center">
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
                    <div className="flex items-center justify-center gap-1 mb-1 flex-wrap">
                      {card.discount && (
                        <span className="bg-neon-green text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
                          {card.discount}
                        </span>
                      )}
                      <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-1 group-hover:text-neon-blue">
                        {card.name}
                      </h3>
                    </div>
                    <div className="flex items-center justify-center space-x-1">
                      <span className="text-xs sm:text-sm md:text-base font-semibold text-neon-blue leading-tight text-center">
                        {card.priceLabel}
                      </span>
                      {card.originalPrice && <span className="text-xs text-gray-500 line-through">{card.originalPrice}</span>}
                    </div>
                  </div>
                </div>
              </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Buy Cryptocurrency Section */}
      <section id="crypto" className="py-12 md:py-20 bg-dark-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 md:mb-16">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-3 md:mb-4 holographic">
              Buy Cryptocurrency
            </h2>
            <p className="text-sm md:text-base text-gray-300 max-w-2xl mx-auto mb-6 md:mb-8">
              Purchase crypto instantly with secure payment methods. Stable coins supported.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-8 md:mb-16">
              <div className="text-center">
                <div className="w-16 h-16 bg-neon-blue/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-8 h-8 text-neon-blue" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Best Rates</h3>
                <p className="text-gray-300">Competitive prices for all cryptocurrencies</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-neon-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-neon-green" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Secure Transactions</h3>
                <p className="text-gray-300">Bank-level security for your purchases</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-neon-purple/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-neon-purple" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Instant Delivery</h3>
                <p className="text-gray-300">Receive crypto in your wallet immediately</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
            {cryptoCoins.map((coin) => (
              <div key={coin.id} className="group card-dark p-4 md:p-6 rounded-xl md:rounded-2xl hover:border-neon-blue/50 text-center active:scale-[0.98] md:hover:-translate-y-1">
                <div className="text-4xl md:text-5xl mb-2 md:mb-3 group-hover:scale-105">{coin.image}</div>
                <h3 className="text-base md:text-lg font-bold text-white mb-0.5 group-hover:text-neon-blue">{coin.name}</h3>
                <p className="text-xs text-gray-400 mb-2">{coin.symbol}</p>
                <p className="text-gray-300 text-xs mb-3 leading-relaxed line-clamp-2 hidden sm:block">{coin.description}</p>
                <button
                  onClick={() => navigate('/crypto')}
                  className="w-full btn-cyber text-white py-1.5 md:py-2 px-3 rounded-lg font-bold text-xs md:text-sm"
                >
                  Buy {coin.symbol}
                </button>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link to="/crypto" className="text-neon-blue hover:text-neon-purple transition-colors duration-300 font-semibold">
              View All Cryptocurrencies
            </Link>
          </div>
        </div>
      </section>

      {/* Payments: virtual cards + digital wallets */}
      <section id="payments" className="py-12 md:py-20 bg-dark-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 md:mb-16">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-3 md:mb-4 holographic">
              Payments
            </h2>
            <p className="text-sm md:text-base text-gray-300 max-w-2xl mx-auto mb-2 md:mb-3">
              Virtual cards and digital wallets — top up or order in one place.
            </p>
            <Link
              to="/payments"
              className="inline-flex text-neon-blue hover:text-neon-purple text-sm font-semibold mb-6 md:mb-8"
            >
              Browse all payment products →
            </Link>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-8 md:mb-16">
              <div className="text-center">
                <div className="w-16 h-16 bg-neon-blue/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Globe className="w-8 h-8 text-neon-blue" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Global Acceptance</h3>
                <p className="text-gray-300">Use your digital wallet anywhere in the world</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-neon-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-neon-green" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Secure Payments</h3>
                <p className="text-gray-300">Protected transactions with encryption</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-neon-purple/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="w-8 h-8 text-neon-purple" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Virtual Cards</h3>
                <p className="text-gray-300">Create virtual cards for safe online shopping</p>
              </div>
            </div>
          </div>

          <div className="mb-16">
            <h3 className="text-2xl font-bold text-white mb-8 text-center">Digital Wallets</h3>
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {walletServices.map((wallet) => (
                <div
                  key={wallet.id}
                  className="group card-dark p-4 md:p-6 rounded-xl md:rounded-2xl hover:border-neon-blue/50 active:scale-[0.98] md:hover:-translate-y-1"
                >
                  <div className="text-center">
                    <div className="relative mb-2 md:mb-4 flex justify-center">
                      <div className="h-12 md:h-16 group-hover:scale-105">
                        <img src={getAbsoluteImageUrl(wallet.image)} alt={wallet.name} className="h-full w-auto object-contain mx-auto" />
                      </div>
                      <div className={`absolute -top-1 right-0 px-1.5 py-0.5 rounded text-[10px] font-bold text-white ${wallet.badgeColor}`}>
                        {wallet.badge}
                      </div>
                    </div>
                    <h4 className="text-sm md:text-base font-bold text-white mb-1 group-hover:text-neon-blue">
                      {wallet.name}
                    </h4>
                    <p className="text-gray-300 text-xs mb-2 md:mb-3 leading-relaxed line-clamp-2">
                      {wallet.description}
                    </p>
                    <Link
                      to="/payments"
                      className="block w-full text-center cyber-border text-white py-1.5 md:py-2 px-3 rounded-lg font-bold text-xs"
                    >
                      Get started
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6 text-center">Virtual Cards</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              {virtualCards.map((card) => (
                <div
                  key={card.id}
                  className="group card-dark p-4 md:p-6 rounded-xl md:rounded-2xl hover:border-neon-blue/50 active:scale-[0.98] md:hover:-translate-y-1"
                >
                  <div className="text-center">
                    <div className="text-3xl md:text-4xl mb-2 md:mb-3 group-hover:scale-105">
                      {card.image}
                    </div>
                    <h4 className="text-sm md:text-base font-bold text-white mb-1 group-hover:text-neon-blue">
                      {card.name}
                    </h4>
                    <p className="text-gray-300 text-xs mb-2 md:mb-3 leading-relaxed line-clamp-2">
                      {card.description}
                    </p>
                    <Link
                      to="/payments"
                      className="block w-full text-center cyber-border text-white py-1.5 md:py-2 px-3 rounded-lg font-bold text-xs"
                    >
                      Order card
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TT & bulk orders (separate from store Payments catalog) */}
      <section id="tt-orders" className="py-20 bg-dark-bg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4 holographic">TT transfers & bulk orders</h2>
            <p className="text-base text-gray-300 max-w-2xl mx-auto">
              Business TT transfers, supplier payments, currency blocks (USD, ZAR, CNY), vehicles, and more.
            </p>
            <Link to="/tt-orders" className="inline-flex mt-4 text-neon-blue hover:text-neon-purple text-sm font-semibold">
              Open full TT order form →
            </Link>
          </div>

          <div className="card-dark p-6 rounded-2xl">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                alert('Your order was submitted. Admin will contact you shortly.');
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Order Type</label>
                  <select className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white">
                    <option>TT Transfer</option>
                    <option>Payment to Supplier</option>
                    <option>Buy Currency (USD)</option>
                    <option>Buy Currency (ZAR)</option>
                    <option>Buy Currency (CNY/Yuan)</option>
                    <option>Vehicle Purchase Payment</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Amount</label>
                  <input type="number" min="0" placeholder="Amount"
                    className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Currency</label>
                  <select className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white">
                    <option>USD</option>
                    <option>MWK</option>
                    <option>ZAR</option>
                    <option>CNY</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Contact Email</label>
                  <input type="email" placeholder="you@example.com"
                    className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-white mb-2">Details</label>
                  <textarea rows={4} placeholder="Describe your order"
                    className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white" />
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button type="submit" className="btn-cyber px-6 py-3 text-white rounded-xl font-bold">Submit Order</button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;