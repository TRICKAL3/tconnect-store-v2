import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { auth } from './lib/firebaseClient';
import { getRedirectResult, onAuthStateChanged } from 'firebase/auth';
import { useAuth } from './context/AuthContext';
import { getApiBase } from './lib/getApiBase';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import GiftCards from './pages/GiftCards';
import GiftCardDetail from './pages/GiftCardDetail';
import Crypto from './pages/Crypto';
import DigitalWallets from './pages/DigitalWallets';
import Payments from './pages/Payments';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import Admin from './pages/Admin';
import Settings from './pages/Settings';
import OrderHistory from './pages/OrderHistory';
import NotificationDetail from './pages/NotificationDetail';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import RefundPolicy from './pages/RefundPolicy';
import AMLPolicy from './pages/AMLPolicy';
import ChatWidget from './components/ChatWidget';
import EnableNotifications from './components/EnableNotifications';

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const isAdmin = location.pathname === '/admin';

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  // Listen for Service Worker messages (for iOS notification navigation)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      try {
        // Listen to messages from service worker
        const handleMessage = (event: Event) => {
          try {
            const messageEvent = event as MessageEvent;
            if (messageEvent.data && messageEvent.data.type === 'navigate') {
              const url = messageEvent.data.url;
              if (url) {
                // Use window.location for better iOS compatibility
                if (url.startsWith('http')) {
                  window.location.href = url;
                } else {
                  navigate(url);
                }
              }
            }
          } catch (error) {
            console.error('Error handling service worker message:', error);
          }
        };

        navigator.serviceWorker.addEventListener('message', handleMessage);

        // Cleanup
        return () => {
          navigator.serviceWorker.removeEventListener('message', handleMessage);
        };
      } catch (error) {
        console.error('Error setting up service worker listener:', error);
        // Don't block app if service worker fails
      }
    }
  }, [navigate]);

  // Handle redirect after successful sign-in/sign-up
  useEffect(() => {
    // Only redirect if auth is not loading and user is authenticated
    if (!authLoading && user && (location.pathname === '/signin' || location.pathname === '/signup')) {
      console.log('✅ User authenticated in App, redirecting to home:', user.email);
      // Use window.location for more aggressive redirect
      window.location.href = '/';
    }
  }, [user, authLoading, location.pathname]);

  // Also check Firebase auth state directly as fallback
  useEffect(() => {
    if (location.pathname === '/signin' || location.pathname === '/signup') {
      const currentUser = auth.currentUser;
      if (currentUser) {
        console.log('Firebase user detected in App, redirecting');
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
      }
    }
  }, [location.pathname]);

  // Handle redirect result from Google OAuth (fallback only - popup is preferred)
  useEffect(() => {
    const handleRedirectResult = async () => {
      const url = window.location.href;
      const hash = window.location.hash;
      const search = window.location.search;
      
      console.log('🔵 [App] ========== CHECKING REDIRECT RESULT ==========');
      console.log('🔵 [App] Full URL:', url);
      console.log('🔵 [App] Hash:', hash);
      console.log('🔵 [App] Search:', search);
      console.log('🔵 [App] Pathname:', window.location.pathname);
      console.log('🔵 [App] Auth domain:', auth.app.options.authDomain);
      console.log('🔵 [App] Current user before getRedirectResult:', auth.currentUser?.email || 'null');
      
      // Check if URL has OAuth parameters (indicates we're returning from OAuth)
      const hasOAuthParams = hash.includes('access_token') || hash.includes('id_token') || search.includes('code=');
      console.log('🔵 [App] Has OAuth params in URL:', hasOAuthParams);
      
      try {
        // getRedirectResult MUST be called before onAuthStateChanged
        console.log('🔵 [App] Calling getRedirectResult...');
        const result = await getRedirectResult(auth);
        console.log('🔵 [App] getRedirectResult returned:', result ? `User: ${result.user?.email}` : 'null');
        console.log('🔵 [App] Current user after getRedirectResult:', auth.currentUser?.email || 'null');
        
        if (result && result.user) {
          console.log('🔵 ✅ [App] ========== REDIRECT RESULT FOUND ==========');
          console.log('🔵 ✅ [App] User email:', result.user.email);
          console.log('🔵 ✅ [App] User UID:', result.user.uid);
          
          // Immediately trigger upsert
          const email = result.user.email;
          const displayName = result.user.displayName || email?.split('@')[0] || 'User';
          const photoURL = result.user.photoURL || undefined;
          
          try {
            const API_BASE = getApiBase();
            console.log('🔵 [App] Upserting user to backend...');
            const upsertRes = await fetch(`${API_BASE}/users/upsert`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, name: displayName, avatarUrl: photoURL })
            });
            if (upsertRes.ok) {
              const userData = await upsertRes.json();
              console.log('🔵 ✅ [App] User upserted successfully:', userData);
            } else {
              const errorText = await upsertRes.text();
              console.error('🔵 ❌ [App] Upsert failed:', upsertRes.status, errorText);
            }
          } catch (error: any) {
            console.error('🔵 ❌ [App] Upsert error:', error);
          }
          
          // Clear URL and redirect
          window.history.replaceState(null, '', '/');
          setTimeout(() => {
            window.location.href = '/';
          }, 300);
        } else if (hasOAuthParams) {
          // URL has OAuth params but getRedirectResult returned null
          // This is a CRITICAL configuration issue
          console.error('🔴 🔴 🔴 CRITICAL ERROR 🔴 🔴 🔴');
          console.error('🔵 ❌ [App] URL has OAuth params but getRedirectResult returned null!');
          console.error('🔵 ❌ [App] This means the redirect URI is NOT configured correctly.');
          console.error('🔵 ❌ [App]');
          console.error('🔵 ❌ [App] REQUIRED FIX:');
          console.error('🔵 ❌ [App] 1. Go to: https://console.cloud.google.com/apis/credentials');
          console.error('🔵 ❌ [App] 2. Select project: tconnect-store-9893e');
          console.error('🔵 ❌ [App] 3. Find OAuth 2.0 Client ID (Web client)');
          console.error('🔵 ❌ [App] 4. Add EXACT redirect URI:', `${window.location.origin}/__/auth/handler`);
          console.error('🔵 ❌ [App] 5. Also add:', window.location.origin);
          console.error('🔵 ❌ [App] 6. Click SAVE');
          console.error('🔵 ❌ [App]');
          console.error('🔵 ❌ [App] Current URL that needs to be whitelisted:', url);
          console.error('🔵 ❌ [App] Hash contains:', hash.substring(0, 100));
          
          // Try to manually parse the hash as a last resort
          if (hash.includes('access_token') || hash.includes('id_token')) {
            console.log('🔵 [App] Attempting manual token parsing...');
            try {
              // Parse hash parameters
              const hashParams = new URLSearchParams(hash.substring(1));
              const idToken = hashParams.get('id_token');
              
              if (idToken) {
                console.log('🔵 [App] Found id_token in hash, but Firebase getRedirectResult failed.');
                console.log('🔵 [App] This confirms the redirect URI is not configured in Google Cloud Console.');
                console.log('🔵 [App] The token exists but Firebase cannot process it without proper redirect URI.');
              }
            } catch (e) {
              console.error('🔵 ❌ [App] Failed to parse hash:', e);
            }
          }
          
          // Wait and check auth state as fallback
          setTimeout(async () => {
            const currentUser = auth.currentUser;
            if (currentUser) {
              console.log('🔵 ✅ [App] User found after delay:', currentUser.email);
              window.history.replaceState(null, '', '/');
              window.location.href = '/';
            } else {
              console.error('🔵 ❌ [App] Still no user after delay.');
              console.error('🔵 ❌ [App] ACTION REQUIRED: Configure redirect URI in Google Cloud Console!');
              alert('⚠️ OAuth redirect failed! Please check the console for instructions. The redirect URI must be added to Google Cloud Console.');
            }
          }, 2000);
        } else {
          console.log('🔵 [App] No redirect result (normal if not returning from OAuth)');
        }
      } catch (error: any) {
        console.error('🔵 ❌ [App] ========== REDIRECT RESULT ERROR ==========');
        console.error('🔵 ❌ [App] Error:', error);
        console.error('🔵 ❌ [App] Error message:', error.message);
        console.error('🔵 ❌ [App] Error code:', error.code);
      }
    };

    // Call immediately
    handleRedirectResult();
  }, []);
  
  // Backup: Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('🔵 [App] Auth state changed:', user ? `User: ${user.email}` : 'No user');
      if (user && (location.pathname === '/signin' || location.pathname === '/signup')) {
        console.log('🔵 [App] User authenticated, redirecting from', location.pathname);
        setTimeout(() => {
          window.location.href = '/';
        }, 500);
      }
    });
    return () => unsubscribe();
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-dark-bg dark-theme animated-bg">
      {!isAdmin && <Header />}
      <main className="min-h-screen">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/giftcards" element={<GiftCards />} />
          <Route path="/giftcard/:id" element={<GiftCardDetail />} />
          <Route path="/crypto" element={<Crypto />} />
          <Route path="/wallets" element={<DigitalWallets />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/orders" element={<OrderHistory />} />
          <Route path="/notifications/:id" element={<NotificationDetail />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/refund" element={<RefundPolicy />} />
          <Route path="/aml" element={<AMLPolicy />} />
        </Routes>
      </main>
      {!isAdmin && <Footer />}
      {!isAdmin && <ChatWidget />}
      {!isAdmin && <EnableNotifications />}
    </div>
  );
}

function App() {
  return (
    <CartProvider>
      <AuthProvider>
        <NotificationProvider>
          <Router>
            <AppContent />
          </Router>
        </NotificationProvider>
      </AuthProvider>
    </CartProvider>
  );
}

export default App;

