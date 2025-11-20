import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Gift, Shield, Zap, CreditCard, TrendingUp, CheckCircle, Globe } from 'lucide-react';
import { getApiBase } from '../lib/getApiBase';
import paypalLogo from '../assets/paypal.jpg';
import skrillLogo from '../assets/skrill.jpg';
import netellerLogo from '../assets/neteller.jpg';
import perfectMoneyLogo from '../assets/perfect-money.jpg';

// Sample promotions (will be replaced by admin slides)
const sampleSlides = [
  {
    id: 'sample-1',
    title: 'Special Offer',
    subtitle: 'Limited Time',
    description: 'Get 10% off on all gift cards this week!',
    image: 'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=800&h=600&fit=crop',
    cta: 'Shop Now',
    ctaLink: '/giftcards',
    active: true
  },
  {
    id: 'sample-2',
    title: 'New Arrivals',
    subtitle: 'Fresh Stock',
    description: 'Check out our latest gift card collection',
    image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=600&fit=crop',
    cta: 'Explore',
    ctaLink: '/giftcards',
    active: true
  },
  {
    id: 'sample-3',
    title: 'Best Deals',
    subtitle: 'Hot Deals',
    description: 'Don\'t miss out on our exclusive offers',
    image: 'https://images.unsplash.com/photo-1556740758-90de374c12ad?w=800&h=600&fit=crop',
    cta: 'View Deals',
    ctaLink: '/giftcards',
    active: true
  }
];

const Home: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState<any[]>([]);
  const navigate = useNavigate();
  const [visibleElements, setVisibleElements] = useState<Set<string>>(new Set());

  // Fetch slides from backend
  useEffect(() => {
    const fetchSlides = async () => {
      try {
        const API_BASE = getApiBase();
        const res = await fetch(`${API_BASE}/slides`);
        const data = await res.json();
        const backendSlides = Array.isArray(data) ? data.filter((s: any) => s.active) : [];
        // Use backend slides if available, otherwise use samples
        setSlides(backendSlides.length > 0 ? backendSlides : sampleSlides);
      } catch (error) {
        console.error('Failed to load slides:', error);
        // Use sample slides if backend fails
        setSlides(sampleSlides);
      }
    };
    fetchSlides();
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

    return () => {
      elements.forEach((el) => observer.unobserve(el));
    };
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
          price: `$${p.priceUsd.toFixed(2)}`, 
          image: p.image, 
          badge: 'Featured', 
          badgeColor: 'bg-neon-blue' 
        })));
        setPopularCards(popular.map((p: any) => ({ 
          id: p.id, 
          name: p.name, 
          price: `$${p.priceUsd.toFixed(2)}`, 
          originalPrice: '', 
          discount: '', 
          image: p.image, 
          rating: 5 
        })));
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
    <div className="min-h-screen">
      {/* Gaming Grid Background */}
      <div className="fixed inset-0 gaming-grid opacity-20 pointer-events-none"></div>
      
      {/* Hero Section with Slogan and Slideshow */}
      <section className="relative py-12 md:py-16 lg:py-20 bg-dark-gradient text-white overflow-hidden">
        {/* Floating Particles */}
        <div className="particles">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="particle"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 6}s`,
                animationDuration: `${6 + Math.random() * 4}s`
              }}
            />
          ))}
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 lg:gap-12 items-center">
            {/* Static Slogan & Description - Left Side */}
            <div className="space-y-4 md:space-y-6 text-center md:text-left order-2 md:order-1">
              <div className="space-y-2 md:space-y-3">
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight font-mono holographic">
                  Premium Gift Cards
                </h1>
                <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-light text-neon-blue">
                  Your One-Stop Digital Store
                </h2>
                <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-300 max-w-xl mx-auto md:mx-0 leading-relaxed">
                  Discover premium gift cards for all your favorite brands. 
                  Easy to purchase, instant to deliver, and perfect for any occasion.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center md:justify-start">
                <Link
                  to="/giftcards"
                  className="btn-cyber text-white px-6 py-3 md:px-8 md:py-4 lg:px-10 lg:py-5 rounded-xl font-bold text-sm sm:text-base md:text-lg lg:text-xl active:scale-95 hover:scale-105 flex items-center justify-center neon-glow transition-all w-auto mx-auto sm:mx-0"
                >
                  Start Shopping
                  <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                </Link>
              </div>
            </div>
            
            {/* Promotional Slideshow - Right Corner */}
            <div className="flex justify-center md:justify-end order-1 md:order-2">
              <div className="relative w-full max-w-md">
                {slides.length > 0 ? (
                  <>
                    {slides.map((slide, index) => (
                      <div
                        key={slide.id}
                        className={`transition-opacity duration-1000 ${
                          index === currentSlide ? 'opacity-100 relative' : 'opacity-0 absolute inset-0 pointer-events-none'
                        }`}
                      >
                        <div className="bg-dark-surface/50 backdrop-blur-sm border border-neon-blue/30 rounded-2xl p-6 md:p-8 shadow-2xl overflow-hidden">
                          <div className="text-center">
                            <div className="mb-4 transform hover:scale-105 transition-transform duration-500 rounded-xl overflow-hidden">
                              {slide.image && (slide.image.startsWith('http') || slide.image.startsWith('/') || slide.image.startsWith('data:')) ? (
                                <img 
                                  src={slide.image} 
                                  alt={slide.title || 'Promotion'} 
                                  className="w-full h-48 sm:h-56 md:h-64 lg:h-72 object-cover rounded-xl"
                                  onError={(e) => {
                                    // Fallback to emoji if image fails
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    const fallback = document.createElement('div');
                                    fallback.className = 'text-6xl sm:text-7xl md:text-8xl lg:text-9xl mb-4 neon-glow';
                                    fallback.textContent = '🎁';
                                    target.parentElement?.appendChild(fallback);
                                  }}
                                />
                              ) : (
                                <div className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl mb-4 neon-glow">
                                  {slide.image || '🎁'}
                                </div>
                              )}
                            </div>
                            {slide.title && (
                              <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2 holographic">
                                {slide.title}
                              </h3>
                            )}
                            {slide.subtitle && (
                              <p className="text-base sm:text-lg md:text-xl text-neon-blue mb-2">
                                {slide.subtitle}
                              </p>
                            )}
                            {slide.description && (
                              <p className="text-sm sm:text-base text-gray-300 mb-4">
                                {slide.description}
                              </p>
                            )}
                            {slide.cta && slide.ctaLink && (
                              <Link
                                to={slide.ctaLink}
                                className="inline-block cyber-border text-white px-4 py-2 rounded-lg font-semibold text-sm md:text-base hover:neon-glow transition-all active:scale-95"
                              >
                                {slide.cta}
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Slideshow indicator */}
                    {slides.length > 1 && (
                      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2">
                        <div className="flex space-x-2">
                          {slides.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={() => setCurrentSlide(idx)}
                              className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-full transition-all duration-300 active:scale-125 ${
                                idx === currentSlide ? 'bg-neon-blue neon-glow scale-125' : 'bg-gray-500 hover:bg-gray-400'
                              }`}
                              aria-label={`Go to slide ${idx + 1}`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-dark-surface/50 backdrop-blur-sm border border-neon-blue/30 rounded-2xl p-6 md:p-8 shadow-2xl text-center">
                    <img 
                      src="https://images.unsplash.com/photo-1607082349566-187342175e2f?w=800&h=600&fit=crop" 
                      alt="No promotions" 
                      className="w-full h-48 sm:h-56 md:h-64 lg:h-72 object-cover rounded-xl mb-4"
                    />
                    <p className="text-gray-400 text-sm">No promotions available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Shop by Category Section */}
      <section className="py-12 md:py-20 bg-dark-bg">
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

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-8">
            {categories.map((category, index) => (
              <Link
                key={category.name}
                to={category.link}
                id={`category-${index}`}
                className={`group card-dark p-4 md:p-8 rounded-xl md:rounded-2xl hover:border-neon-blue/50 transition-all duration-300 transform active:scale-95 md:hover:-translate-y-2 fade-in-on-scroll ${visibleElements.has(`category-${index}`) ? 'visible' : ''}`}
              >
                <div className="text-center">
                  <div className="text-4xl md:text-6xl mb-3 md:mb-4 group-hover:scale-110 transition-transform duration-300">
                    {category.icon}
                  </div>
                  <h3 className="text-base md:text-xl font-bold text-white mb-2 group-hover:text-neon-blue transition-colors duration-300">
                    {category.name}
                  </h3>
                  <p className="text-xs md:text-sm text-gray-300 mb-3 md:mb-4 leading-relaxed">
                    {category.description}
                  </p>
                  <div className="flex items-center justify-center text-neon-blue group-hover:text-neon-purple transition-colors duration-300">
                    <span className="text-xs md:text-sm font-semibold">Explore</span>
                    <ArrowRight className="ml-2 w-3 h-3 md:w-4 md:h-4" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Gift Cards Section */}
      <section className="py-12 md:py-20 bg-dark-surface">
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {featuredCards.map((card) => (
              <div
                key={card.id}
                className="group card-dark rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden border border-dark-border hover:border-neon-blue/50"
              >
                <div className="p-4">
                  <div className="relative">
                    <div className={`absolute -top-1 -right-1 px-2 py-1 rounded-full text-xs font-bold text-white ${card.badgeColor}`}>
                      {card.badge}
                    </div>
                    <div className="text-center">
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
                      <h3 className="text-sm font-bold text-white mb-2 group-hover:text-neon-blue transition-colors duration-300 line-clamp-2">
                        {card.name}
                      </h3>
                      <div className="text-base font-bold text-neon-blue mb-1">
                        {card.price}
                      </div>
                      
                    </div>
                  </div>
                </div>
              </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Most Popular Gift Cards Section */}
      <section className="py-12 md:py-20 bg-dark-bg">
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {popularCards.map((card) => (
              <div
                key={card.id}
                className="group card-dark rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden border border-dark-border hover:border-neon-blue/50"
              >
                <div className="p-4">
                  <div className="text-center">
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
                    <div className="flex items-center justify-center mb-2">
                      <div className="bg-neon-green text-white px-2 py-1 rounded text-xs font-bold mr-1">
                        {card.discount}
                      </div>
                      <h3 className="text-sm font-bold text-white group-hover:text-neon-blue transition-colors duration-300 line-clamp-1">
                        {card.name}
                      </h3>
                    </div>
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <span className="text-base font-bold text-neon-blue">{card.price}</span>
                      <span className="text-sm text-gray-500 line-through">{card.originalPrice}</span>
                    </div>
                    
                  </div>
                </div>
              </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Buy Cryptocurrency Section */}
      <section className="py-12 md:py-20 bg-dark-surface">
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

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
            {cryptoCoins.map((coin) => (
              <div key={coin.id} className="group card-dark p-6 rounded-2xl hover:border-neon-blue/50 transition-all duration-300 transform hover:-translate-y-2 text-center">
                <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">{coin.image}</div>
                <h3 className="text-xl font-bold text-white mb-1 group-hover:text-neon-blue transition-colors duration-300">{coin.name}</h3>
                <p className="text-sm text-gray-400 mb-3">{coin.symbol}</p>
                <p className="text-gray-300 text-sm mb-4 leading-relaxed">{coin.description}</p>
                <button
                  onClick={() => navigate('/crypto')}
                  className="w-full btn-cyber text-white py-2 px-4 rounded-xl font-bold text-sm transition-all duration-300 hover:scale-105"
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

      {/* Digital Wallets & Virtual Cards Section */}
      <section className="py-12 md:py-20 bg-dark-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 md:mb-16">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-3 md:mb-4 holographic">
              Digital Wallets & Virtual Cards
            </h2>
            <p className="text-sm md:text-base text-gray-300 max-w-2xl mx-auto mb-6 md:mb-8">
              Secure payment solutions for the digital age
            </p>
            
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {walletServices.map((wallet) => (
                <div
                  key={wallet.id}
                  className="group card-dark p-6 rounded-2xl hover:border-neon-blue/50 transition-all duration-300 transform hover:-translate-y-2"
                >
                  <div className="text-center">
                    <div className="relative mb-4 flex justify-center">
                      <div className="h-20 w-auto group-hover:scale-110 transition-transform duration-300">
                        <img src={wallet.image} alt={wallet.name} className="h-full w-auto object-contain mx-auto" />
                      </div>
                      <div className={`absolute -top-2 -right-2 px-2 py-1 rounded text-xs font-bold text-white ${wallet.badgeColor}`}>
                        {wallet.badge}
                      </div>
                    </div>
                    <h4 className="text-lg font-bold text-white mb-2 group-hover:text-neon-blue transition-colors duration-300">
                      {wallet.name}
                    </h4>
                    <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                      {wallet.description}
                    </p>
                    <button className="w-full cyber-border text-white py-2 px-4 rounded-xl font-bold transition-all duration-300 hover:scale-105 hover:neon-glow">
                      Get Started
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-2xl font-bold text-white mb-8 text-center">Virtual Cards</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {virtualCards.map((card) => (
                <div
                  key={card.id}
                  className="group card-dark p-6 rounded-2xl hover:border-neon-blue/50 transition-all duration-300 transform hover:-translate-y-2"
                >
                  <div className="text-center">
                    <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300">
                      {card.image}
                    </div>
                    <h4 className="text-lg font-bold text-white mb-2 group-hover:text-neon-blue transition-colors duration-300">
                      {card.name}
                    </h4>
                    <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                      {card.description}
                    </p>
                    <button className="w-full cyber-border text-white py-2 px-4 rounded-xl font-bold transition-all duration-300 hover:scale-105 hover:neon-glow">
                      Order Card
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-dark-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4 holographic">
              How It Works
            </h2>
            <p className="text-base text-gray-300 max-w-2xl mx-auto">
              Getting your favorite gift cards has never been easier
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((step, index) => (
              <div key={step.step} className="text-center">
                <div className="relative mb-6">
                  <div className="w-20 h-20 bg-neon-blue/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <div className="text-neon-blue">
                      {step.icon}
                    </div>
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-neon-blue rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {step.step}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-4">
                  {step.title}
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bulk Payments / Orders Section */}
      <section id="payments" className="py-20 bg-dark-bg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4 holographic">Payments & TT Orders</h2>
            <p className="text-base text-gray-300 max-w-2xl mx-auto">
              Place bulk requests for TT transfers, business payments, or currency purchases (USD, ZAR, CNY).
            </p>
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