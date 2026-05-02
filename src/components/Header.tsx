import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, Menu, X, Settings, LogOut, Package, Gift, Home, CreditCard, TrendingUp, User, Tag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { getApiBase } from '../lib/getApiBase';
import NotificationBell from './NotificationBell';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const { state } = useCart();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [pointsBalance, setPointsBalance] = useState(0);

  // Fetch user points balance
  useEffect(() => {
    const fetchPoints = async () => {
      if (user?.email) {
        try {
          const API_BASE = getApiBase();
          const res = await fetch(`${API_BASE}/users/profile?email=${encodeURIComponent(user.email)}`);
          if (res.ok) {
            const profile = await res.json();
            setPointsBalance(profile.pointsBalance || 0);
          }
        } catch (error) {
          console.error('Failed to fetch points:', error);
        }
      } else {
        setPointsBalance(0);
      }
    };
    fetchPoints();
    // Refresh points every 30 seconds
    const interval = setInterval(fetchPoints, 30000);
    return () => clearInterval(interval);
  }, [user?.email]);

  const navigation = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Gift Cards', href: '/giftcards', icon: Gift },
    { name: 'Crypto', href: '/crypto', icon: Package },
    { name: 'Payments', href: '/payments', icon: CreditCard },
    { name: 'Rates', href: '/rates', icon: TrendingUp },
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-transparent">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex justify-between items-center py-3 md:py-4 gap-4">
          {/* Logo */}
          <Link 
            to="/" 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center group flex-shrink-0"
          >
            <img src="/tconnect_logo-removebg-preview.png" alt="tConnect" className="h-[4.5rem] sm:h-20 md:h-24 lg:h-28 xl:h-36 w-auto object-contain group-hover:opacity-90 transition-opacity duration-200 brightness-0 invert" />
          </Link>

          {/* Desktop nav — plain links, no pill bar */}
          <nav className="hidden lg:flex items-center gap-6 xl:gap-8 flex-1 justify-center flex-wrap min-w-0">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium transition-colors ${
                    isActive ? 'text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0 opacity-80" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right: cart, profile, notifications, menu */}
          <div className="flex items-center gap-1 sm:gap-2 md:gap-3 flex-shrink-0">
            <Link
              to="/cart"
              className="relative flex items-center justify-center p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Cart"
            >
              <ShoppingCart className="w-5 h-5" />
              {state.itemCount > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-gray-200 text-dark-bg text-[10px] font-bold rounded-full min-w-[1rem] h-4 px-0.5 flex items-center justify-center">
                  {state.itemCount > 9 ? '9+' : state.itemCount}
                </span>
              )}
            </Link>

            <div className="relative" ref={profileDropdownRef}>
              <button
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center overflow-hidden text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                aria-expanded={isProfileDropdownOpen}
                aria-label="Account menu"
              >
                {user && user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-5 h-5" />
                )}
              </button>

              {/* Dropdown Menu */}
              {isProfileDropdownOpen && (
                <>
                  {/* Backdrop for mobile */}
                  <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsProfileDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-xs sm:max-w-sm md:w-56 md:max-w-none bg-dark-card border border-dark-border rounded-lg shadow-xl z-50 overflow-hidden left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-0">
                    <div className="py-2">
                      {user ? (
                        <>
                          <div className="px-4 py-2 border-b border-dark-border">
                            <p className="text-white font-semibold text-sm">{user.name || 'User'}</p>
                            <p className="text-gray-400 text-xs truncate">{user.email}</p>
                          </div>
                          {/* Points Balance */}
                          <div className="px-4 py-3 border-b border-dark-border bg-purple-600/10">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Gift className="w-4 h-4 text-purple-400" />
                                <span className="text-gray-300 text-sm">TConnect Points</span>
                              </div>
                              <span className="text-purple-400 font-bold text-lg">{pointsBalance.toLocaleString()}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              ≈ ${((pointsBalance / 1300) * 10).toFixed(2)} value
                            </div>
                          </div>
                          <Link
                            to="/profile"
                            onClick={() => setIsProfileDropdownOpen(false)}
                            className="flex items-center px-4 py-3 text-gray-300 hover:text-white hover:bg-dark-surface transition-colors"
                          >
                            <User className="w-5 h-5 mr-3 text-gray-400" />
                            My Profile
                          </Link>
                          <Link
                            to="/orders"
                            onClick={() => setIsProfileDropdownOpen(false)}
                            className="flex items-center px-4 py-3 text-gray-300 hover:text-white hover:bg-dark-surface transition-colors"
                          >
                            <Package className="w-5 h-5 mr-3 text-gray-400" />
                            Order History
                          </Link>
                          <Link
                            to="/my-promotions"
                            onClick={() => setIsProfileDropdownOpen(false)}
                            className="flex items-center px-4 py-3 text-gray-300 hover:text-white hover:bg-dark-surface transition-colors"
                          >
                            <Tag className="w-5 h-5 mr-3 text-gray-400" />
                            My Promotions
                          </Link>
                          <Link
                            to="/settings"
                            onClick={() => setIsProfileDropdownOpen(false)}
                            className="flex items-center px-4 py-3 text-gray-300 hover:text-white hover:bg-dark-surface transition-colors"
                          >
                            <Settings className="w-5 h-5 mr-3 text-gray-400" />
                            Settings
                          </Link>
                          <button
                            onClick={() => {
                              setIsProfileDropdownOpen(false);
                              signOut();
                            }}
                            className="w-full flex items-center px-4 py-3 text-gray-300 hover:text-white hover:bg-dark-surface transition-colors"
                          >
                            <LogOut className="w-5 h-5 mr-3 text-gray-400" />
                            Logout
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="px-4 py-3 border-b border-dark-border">
                            <p className="text-white font-semibold text-sm">Welcome to TConnect</p>
                            <p className="text-gray-400 text-xs">Sign in or create an account</p>
                          </div>
                          <Link
                            to="/signin"
                            onClick={() => setIsProfileDropdownOpen(false)}
                            className="flex items-center px-4 py-3 text-gray-300 hover:text-white hover:bg-dark-surface transition-colors text-sm font-medium"
                          >
                            Sign In
                          </Link>
                          <Link
                            to="/signup"
                            onClick={() => setIsProfileDropdownOpen(false)}
                            className="flex items-center px-4 py-3 text-gray-300 hover:text-white hover:bg-dark-surface transition-colors text-sm font-medium"
                          >
                            Create Account
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Notification Bell - Only show if user is logged in */}
            {user && <NotificationBell />}

            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden p-2 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="lg:hidden pb-4 border-t border-white/10 mt-2 pt-2">
            <div className="space-y-0.5">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'text-white bg-white/5' : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
              {!user ? (
                <>
                  <Link
                    to="/signin"
                    className="block px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-dark-surface active:scale-95 transition-all"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    className="block px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-dark-surface active:scale-95 transition-all"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Sign Up
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/profile"
                    className="block px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-dark-surface active:scale-95 transition-all"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    My Profile
                  </Link>
                  <Link
                    to="/orders"
                    className="block px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-dark-surface active:scale-95 transition-all"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Order History
                  </Link>
                  <Link
                    to="/my-promotions"
                    className="block px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-dark-surface active:scale-95 transition-all"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    My Promotions
                  </Link>
                  <Link
                    to="/settings"
                    className="block px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-dark-surface active:scale-95 transition-all"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Settings
                  </Link>
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      signOut();
                    }}
                    className="w-full text-left block px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-dark-surface active:scale-95 transition-all"
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
