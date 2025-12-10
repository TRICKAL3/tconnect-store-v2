import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, Menu, X, User, Settings, LogOut, Package, LogIn, Gift } from 'lucide-react';
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
    { name: 'Home', href: '/' },
    { name: 'Gift Cards', href: '/giftcards' },
    { name: 'Crypto', href: '/crypto' },
    { name: 'Digital Wallets & Cards', href: '/wallets' },
    { name: 'Payments & TT Orders', href: '/payments' },
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
    <header className="bg-white/95 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
        <div className="flex justify-between items-center h-20 md:h-24">
          {/* Logo */}
          <Link 
            to="/" 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center group flex-shrink-0"
          >
            <img src={tconnectLogo} alt="tConnect" className="h-12 sm:h-14 md:h-16 w-auto object-contain group-hover:opacity-80 transition-opacity duration-300" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  location.pathname === item.href
                    ? 'text-blue-600 bg-blue-50 font-semibold'
                    : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Cart and Mobile Menu */}
          <div className="flex items-center space-x-2 md:space-x-4">
            {/* Profile Dropdown */}
            <div className="relative" ref={profileDropdownRef}>
              {!user ? (
                <button
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 hover:bg-gray-200 transition-all active:scale-95"
                >
                  <User className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />
                </button>
              ) : (
                <button
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden border border-blue-200 hover:bg-blue-200 transition-all active:scale-95"
                >
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-blue-600 font-semibold text-xs md:text-sm">{avatarLetter}</span>
                  )}
                </button>
              )}

              {/* Dropdown Menu */}
              {isProfileDropdownOpen && (
                <>
                  {/* Backdrop for mobile */}
                  <div 
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsProfileDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-xs sm:max-w-sm md:w-56 md:max-w-none bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-0">
                  {!user ? (
                    <div className="py-2">
                      <Link
                        to="/signin"
                        onClick={() => setIsProfileDropdownOpen(false)}
                        className="flex items-center px-4 py-3 text-gray-700 hover:text-blue-600 hover:bg-gray-50 transition-colors"
                      >
                        <LogIn className="w-5 h-5 mr-3 text-gray-500" />
                        Sign In
                      </Link>
                      <Link
                        to="/signup"
                        onClick={() => setIsProfileDropdownOpen(false)}
                        className="flex items-center px-4 py-3 text-gray-700 hover:text-blue-600 hover:bg-gray-50 transition-colors"
                      >
                        <User className="w-5 h-5 mr-3 text-gray-500" />
                        Sign Up
                      </Link>
                    </div>
                  ) : (
                    <div className="py-2">
                      <div className="px-4 py-2 border-b border-gray-200">
                        <p className="text-gray-900 font-semibold text-sm">{user.name || 'User'}</p>
                        <p className="text-gray-500 text-xs truncate">{user.email}</p>
                      </div>
                      {/* Points Balance */}
                      <div className="px-4 py-3 border-b border-gray-200 bg-blue-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Gift className="w-4 h-4 text-blue-600" />
                            <span className="text-gray-700 text-sm">TConnect Points</span>
                          </div>
                          <span className="text-blue-600 font-bold text-lg">{pointsBalance.toLocaleString()}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          ≈ ${((pointsBalance / 1300) * 10).toFixed(2)} value
                        </div>
                      </div>
                      <Link
                        to="/orders"
                        onClick={() => setIsProfileDropdownOpen(false)}
                        className="flex items-center px-4 py-3 text-gray-700 hover:text-blue-600 hover:bg-gray-50 transition-colors"
                      >
                        <Package className="w-5 h-5 mr-3 text-gray-500" />
                        Order History
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setIsProfileDropdownOpen(false)}
                        className="flex items-center px-4 py-3 text-gray-700 hover:text-blue-600 hover:bg-gray-50 transition-colors"
                      >
                        <Settings className="w-5 h-5 mr-3 text-gray-500" />
                        Settings
                      </Link>
                      <button
                        onClick={() => {
                          setIsProfileDropdownOpen(false);
                          signOut();
                        }}
                        className="w-full flex items-center px-4 py-3 text-gray-700 hover:text-red-600 hover:bg-gray-50 transition-colors"
                      >
                        <LogOut className="w-5 h-5 mr-3 text-gray-500" />
                        Logout
                      </button>
                    </div>
                  )}
                  </div>
                </>
              )}
            </div>
            
            {/* Notification Bell - Only show if user is logged in */}
            {user && <NotificationBell />}
            
            {/* Cart Button */}
            <Link
              to="/cart"
              className="relative p-2 md:p-3 text-gray-600 hover:text-blue-600 transition-all duration-200 hover:bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 active:scale-95"
            >
              <ShoppingCart className="w-5 h-5 md:w-6 md:h-6" />
              {state.itemCount > 0 && (
                <span className="absolute -top-1 -right-1 md:-top-2 md:-right-2 bg-blue-600 text-white text-xs rounded-full h-5 w-5 md:h-6 md:w-6 flex items-center justify-center font-bold text-[10px] md:text-xs shadow-sm">
                  {state.itemCount > 9 ? '9+' : state.itemCount}
                </span>
              )}
            </Link>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 text-gray-600 hover:text-blue-600 transition-all duration-200 hover:bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 active:scale-95"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden pb-4">
            <div className="px-3 pt-3 pb-4 space-y-2 bg-white rounded-lg mt-3 border border-gray-200 shadow-sm">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`block px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 active:scale-95 ${
                    location.pathname === item.href
                      ? 'text-blue-600 bg-blue-50 font-semibold'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              {!user ? (
                <>
                  <Link
                    to="/signin"
                    className="block px-4 py-3 rounded-lg text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 active:scale-95 transition-all"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    className="block px-4 py-3 rounded-lg text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 active:scale-95 transition-all"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Sign Up
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/orders"
                    className="block px-4 py-3 rounded-lg text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 active:scale-95 transition-all"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Order History
                  </Link>
                  <Link
                    to="/settings"
                    className="block px-4 py-3 rounded-lg text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 active:scale-95 transition-all"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Settings
                  </Link>
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      signOut();
                    }}
                    className="w-full text-left block px-4 py-3 rounded-lg text-sm font-medium text-gray-700 hover:text-red-600 hover:bg-gray-50 active:scale-95 transition-all"
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
