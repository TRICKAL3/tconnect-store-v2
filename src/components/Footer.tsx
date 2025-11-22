import React from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Mail, Phone, MapPin, Shield, Lock, Building2, Instagram, Facebook } from 'lucide-react';
import tconnectLogo from '../assets/tconnect_logo.png';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center">
              <img src={tconnectLogo} alt="tConnect" className="h-20 w-auto object-contain" />
            </div>
            <p className="text-gray-300 text-sm">
              Your trusted destination for gift cards and cryptocurrency purchases. 
              Secure, fast, and reliable transactions.
            </p>
            <div className="flex space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-300">
                <Shield className="w-4 h-4" />
                <span>Secure</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-300">
                <Lock className="w-4 h-4" />
                <span>Encrypted</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-gray-300 hover:text-white transition-colors duration-200">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/giftcards" className="text-gray-300 hover:text-white transition-colors duration-200">
                  Gift Cards
                </Link>
              </li>
              <li>
                <Link to="/crypto" className="text-gray-300 hover:text-white transition-colors duration-200">
                  Cryptocurrency
                </Link>
              </li>
              <li>
                <Link to="/cart" className="text-gray-300 hover:text-white transition-colors duration-200">
                  Shopping Cart
                </Link>
              </li>
              <li>
                <button 
                  onClick={() => { 
                    const chatButton = document.querySelector('[aria-label="Open chat"]') as HTMLButtonElement;
                    if (chatButton) chatButton.click();
                  }} 
                  className="text-gray-300 hover:text-white transition-colors duration-200 text-left"
                >
                  Live Chat
                </button>
              </li>
            </ul>
          </div>

          {/* Categories */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Categories</h3>
            <ul className="space-y-2">
              <li className="text-gray-300">Fashion</li>
              <li className="text-gray-300">Retail</li>
              <li className="text-gray-300">Entertainment</li>
              <li className="text-gray-300">Gaming</li>
              <li className="text-gray-300">Software</li>
              <li className="text-gray-300">Utilities</li>
            </ul>
          </div>

          {/* Contact & Support */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Contact Us</h3>
            <div className="space-y-2">
              <div className="flex items-start space-x-2 text-gray-300">
                <MapPin className="w-4 h-4 mt-1 flex-shrink-0" />
                <span className="text-sm">Development House, Blantyre, Third Floor, Office 307</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-300">
                <Mail className="w-4 h-4" />
                <a href="mailto:contact@tconnect.store" className="text-sm hover:text-neon-blue transition-colors">contact@tconnect.store</a>
              </div>
              <div className="flex items-center space-x-2 text-gray-300">
                <Phone className="w-4 h-4" />
                <a href="tel:+265997407598" className="text-sm hover:text-neon-blue transition-colors">+265 997 40 75 98</a>
              </div>
            </div>
            <div className="pt-4">
              <h4 className="text-sm font-semibold mb-3">Follow Us</h4>
              <div className="flex space-x-4">
                <a href="https://www.instagram.com/tconnect.mw?utm_source=qr&igsh=am80OWR6OWZ0MGlp" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-pink-500 transition-colors" aria-label="Follow us on Instagram">
                  <Instagram className="w-5 h-5" />
                </a>
                <a href="https://www.facebook.com/profile.php?id=61568004368033" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-blue-500 transition-colors" aria-label="Follow us on Facebook">
                  <Facebook className="w-5 h-5" />
                </a>
                <a href="https://vm.tiktok.com/ZMHvxsmx4Lnqc-teJro/" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white transition-colors" aria-label="Follow us on TikTok">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 000 15.38a6.34 6.34 0 006.33 6.34 6.33 6.33 0 005.85-3.93v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
                  </svg>
                </a>
              </div>
            </div>
            <div className="pt-4">
              <h4 className="text-sm font-semibold mb-2">Payment Methods</h4>
              <ul className="space-y-2">
                <li className="flex items-center space-x-2 text-gray-300 text-sm">
                  <Building2 className="w-4 h-4 text-neon-blue" />
                  <span>Bank Transfer</span>
                </li>
                <li className="flex items-center space-x-2 text-gray-300 text-sm">
                  <CreditCard className="w-4 h-4 text-purple-400" />
                  <span>Bank Card</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © 2024 TConnect Store v2.0. All rights reserved.
            </p>
            <div className="flex flex-wrap gap-4 md:gap-6 mt-4 md:mt-0">
              <Link to="/privacy" className="text-gray-400 hover:text-white text-sm transition-colors duration-200">
                Privacy Policy
              </Link>
              <Link to="/terms" className="text-gray-400 hover:text-white text-sm transition-colors duration-200">
                Terms of Service
              </Link>
              <Link to="/refund" className="text-gray-400 hover:text-white text-sm transition-colors duration-200">
                Refund Policy
              </Link>
              <Link to="/aml" className="text-gray-400 hover:text-white text-sm transition-colors duration-200">
                Anti-Money Laundering Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
