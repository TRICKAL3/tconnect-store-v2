import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, Menu, X, User, Settings, LogOut, Package, LogIn, Gift, Home, Search, Calendar, Monitor, Gamepad2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { getApiBase } from '../lib/getApiBase';
import NotificationBell from './NotificationBell';
import tconnectLogo from '../assets/tconnect_logo.png';

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
    { name: 'Digital Wallets & Cards', href: '/wallets', icon: Package },
    { name: 'Payments & TT Orders', href: '/payments', icon: Package },
  ];

  const avatarLetter = (user?.email || 'U').charAt(0).toUpperCase();

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
    <header className="bg-dark-surface/95 backdrop-blur-md sticky top-0 z-50 shadow-lg">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex justify-between items-center py-3 md:py-4">
          {/* Logo */}
          <Link 
            to="/" 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center group flex-shrink-0"
          >
            <img src="/tconnect_logo-removebg-preview.png" alt="tConnect" className="h-28 sm:h-32 md:h-36 lg:h-40 w-auto object-contain group-hover:opacity-80 transition-opacity duration-300 brightness-0 invert" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-1 flex-1 justify-center">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'text-white bg-purple-600/30 border-b-2 border-purple-400'
                      : 'text-white hover:text-purple-300 hover:bg-dark-card/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Side: Search, Cart, Auth */}
          <div className="flex items-center space-x-2 md:space-x-3">
            {/* Search Button */}
            <button
              className="hidden md:flex items-center space-x-2 px-3 py-2 text-white hover:text-purple-300 hover:bg-dark-card/50 rounded-lg transition-all duration-200"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
              <span className="hidden lg:inline text-sm">Search</span>
            </button>

            {/* Cart Button */}
            <Link
              to="/cart"
              className="relative p-2 text-white hover:text-purple-300 hover:bg-dark-card/50 rounded-lg transition-all duration-200 active:scale-95"
            >
              <ShoppingCart className="w-5 h-5" />
              {state.itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold text-[10px]">
                  {state.itemCount > 9 ? '9+' : state.itemCount}
                </span>
              )}
            </Link>

            {/* Auth Buttons / Profile */}
            {!user ? (
              <div className="hidden md:flex items-center space-x-2">
                <Link
                  to="/signin"
                  className="px-3 py-2 text-white hover:text-purple-300 hover:bg-dark-card/50 rounded-lg transition-all duration-200 text-sm"
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all duration-200 text-sm font-medium"
                >
                  Create Account
                </Link>
              </div>
            ) : (
              <div className="relative" ref={profileDropdownRef}>
                <button
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-dark-card flex items-center justify-center overflow-hidden border border-dark-border hover:border-purple-400 transition-all active:scale-95"
                >
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white font-bold text-xs md:text-sm">{avatarLetter}</span>
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
                        to="/orders"
                        onClick={() => setIsProfileDropdownOpen(false)}
                        className="flex items-center px-4 py-3 text-gray-300 hover:text-white hover:bg-dark-surface transition-colors"
                      >
                        <Package className="w-5 h-5 mr-3 text-gray-400" />
                        Order History
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
                    </div>
                  </div>
                </>
              )}
              </div>
            )}

            {/* Notification Bell - Only show if user is logged in */}
            {user && <NotificationBell />}

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden p-2 text-white hover:text-purple-300 hover:bg-dark-card/50 rounded-lg transition-all duration-200 active:scale-95"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="lg:hidden pb-4">
            <div className="px-3 pt-3 pb-4 space-y-2 bg-dark-card rounded-lg mt-3 border border-dark-border shadow-xl">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center space-x-2 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 active:scale-95 ${
                      isActive
                        ? 'text-white bg-purple-600/30 border-b-2 border-purple-400'
                        : 'text-gray-300 hover:text-white hover:bg-dark-surface'
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Icon className="w-4 h-4" />
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
                    to="/orders"
                    className="block px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-dark-surface active:scale-95 transition-all"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Order History
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
      {/* Border line after all header content */}
      <div className="border-b border-dark-border"></div>
    </header>
  );
};

export default Header;
