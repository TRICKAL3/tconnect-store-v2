import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, Menu, X, User, Settings, LogOut, Package, LogIn } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import tconnectLogo from '../assets/tconnect_logo.png';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const { state } = useCart();
  const location = useLocation();
  const { user, signOut } = useAuth();

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
    <header className="bg-dark-surface/95 backdrop-blur-md border-b border-dark-border sticky top-0 z-50 neon-glow">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
        <div className="flex justify-between items-center h-24 md:h-32 lg:h-40">
          {/* Logo */}
          <Link to="/" className="flex items-center group flex-shrink-0">
            <img src={tconnectLogo} alt="tConnect" className="h-24 md:h-32 lg:h-40 xl:h-48 w-auto object-contain group-hover:scale-105 transition-transform duration-300" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-2">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 border-2 ${
                  location.pathname === item.href
                    ? 'text-white bg-neon-blue/20 border-neon-blue neon-glow'
                    : 'text-gray-300 hover:text-white hover:bg-dark-card border-dark-border hover:border-neon-blue hover:neon-glow'
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
                  className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-neon-blue/20 flex items-center justify-center border-2 border-neon-blue/30 hover:border-neon-blue transition-all active:scale-95"
                >
                  <User className="w-4 h-4 md:w-5 md:h-5 text-neon-blue" />
                </button>
              ) : (
                <button
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-neon-blue/20 flex items-center justify-center overflow-hidden border-2 border-neon-blue/30 hover:border-neon-blue transition-all active:scale-95"
                >
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-neon-blue font-bold text-xs md:text-sm">{avatarLetter}</span>
                  )}
                </button>
              )}

              {/* Dropdown Menu */}
              {isProfileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-dark-card border border-dark-border rounded-xl shadow-xl z-50 overflow-hidden neon-glow">
                  {!user ? (
                    <div className="py-2">
                      <Link
                        to="/signin"
                        onClick={() => setIsProfileDropdownOpen(false)}
                        className="flex items-center px-4 py-3 text-gray-300 hover:text-white hover:bg-dark-surface transition-colors"
                      >
                        <LogIn className="w-5 h-5 mr-3" />
                        Sign In
                      </Link>
                      <Link
                        to="/signup"
                        onClick={() => setIsProfileDropdownOpen(false)}
                        className="flex items-center px-4 py-3 text-gray-300 hover:text-white hover:bg-dark-surface transition-colors"
                      >
                        <User className="w-5 h-5 mr-3" />
                        Sign Up
                      </Link>
                    </div>
                  ) : (
                    <div className="py-2">
                      <div className="px-4 py-2 border-b border-dark-border">
                        <p className="text-white font-semibold text-sm">{user.name || 'User'}</p>
                        <p className="text-gray-400 text-xs truncate">{user.email}</p>
                      </div>
                      <Link
                        to="/orders"
                        onClick={() => setIsProfileDropdownOpen(false)}
                        className="flex items-center px-4 py-3 text-gray-300 hover:text-white hover:bg-dark-surface transition-colors"
                      >
                        <Package className="w-5 h-5 mr-3" />
                        Order History
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setIsProfileDropdownOpen(false)}
                        className="flex items-center px-4 py-3 text-gray-300 hover:text-white hover:bg-dark-surface transition-colors"
                      >
                        <Settings className="w-5 h-5 mr-3" />
                        Settings
                      </Link>
                      <button
                        onClick={() => {
                          setIsProfileDropdownOpen(false);
                          signOut();
                        }}
                        className="w-full flex items-center px-4 py-3 text-gray-300 hover:text-white hover:bg-dark-surface transition-colors"
                      >
                        <LogOut className="w-5 h-5 mr-3" />
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Cart Button */}
            <Link
              to="/cart"
              className="relative p-2 md:p-3 text-gray-300 hover:text-neon-blue transition-all duration-300 hover:bg-dark-card rounded-xl border border-dark-border hover:border-neon-blue hover:neon-glow active:scale-95"
            >
              <ShoppingCart className="w-5 h-5 md:w-6 md:h-6" />
              {state.itemCount > 0 && (
                <span className="absolute -top-1 -right-1 md:-top-2 md:-right-2 bg-neon-blue text-white text-xs rounded-full h-5 w-5 md:h-6 md:w-6 flex items-center justify-center font-bold neon-glow text-[10px] md:text-xs">
                  {state.itemCount > 9 ? '9+' : state.itemCount}
                </span>
              )}
            </Link>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 text-gray-300 hover:text-neon-blue transition-all duration-300 hover:bg-dark-card rounded-xl border border-dark-border hover:border-neon-blue active:scale-95"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden pb-4">
            <div className="px-3 pt-3 pb-4 space-y-2 bg-dark-card rounded-xl mt-3 border border-dark-border neon-glow">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`block px-4 py-3 rounded-lg text-sm font-bold transition-all duration-300 border-2 active:scale-95 ${
                    location.pathname === item.href
                      ? 'text-white bg-neon-blue/20 border-neon-blue neon-glow'
                      : 'text-gray-300 hover:text-white hover:bg-dark-surface border-dark-border hover:border-neon-blue'
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
                    className="block px-4 py-3 rounded-lg text-sm font-bold text-gray-300 hover:text-white hover:bg-dark-surface border border-dark-border active:scale-95 transition-all"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    className="block px-4 py-3 rounded-lg text-sm font-bold text-gray-300 hover:text-white hover:bg-dark-surface border border-dark-border active:scale-95 transition-all"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Sign Up
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/orders"
                    className="block px-4 py-3 rounded-lg text-sm font-bold text-gray-300 hover:text-white hover:bg-dark-surface border border-dark-border active:scale-95 transition-all"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Order History
                  </Link>
                  <Link
                    to="/settings"
                    className="block px-4 py-3 rounded-lg text-sm font-bold text-gray-300 hover:text-white hover:bg-dark-surface border border-dark-border active:scale-95 transition-all"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Settings
                  </Link>
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      signOut();
                    }}
                    className="w-full text-left block px-4 py-3 rounded-lg text-sm font-bold text-gray-300 hover:text-white hover:bg-dark-surface border border-dark-border active:scale-95 transition-all"
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
