import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { auth } from './lib/firebaseClient';
import { getRedirectResult, onAuthStateChanged } from 'firebase/auth';
import { useAuth } from './context/AuthContext';
import { getApiBase } from './lib/getApiBase';
import Header from './components/Header';
import Footer from './components/Footer';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import ChatWidget from './components/ChatWidget';
import EnableNotifications from './components/EnableNotifications';
import AppLoader from './components/AppLoader';

// Lazy load all pages so initial bundle is small and app becomes interactive faster
const Home = lazy(() => import('./pages/Home'));
const GiftCards = lazy(() => import('./pages/GiftCards'));
const GiftCardDetail = lazy(() => import('./pages/GiftCardDetail'));
const Crypto = lazy(() => import('./pages/Crypto'));
const DigitalWallets = lazy(() => import('./pages/DigitalWallets'));
const TtOrders = lazy(() => import('./pages/TtOrders'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const WalletPage = lazy(() => import('./pages/Wallet'));
const CheckoutCardChat = lazy(() => import('./pages/CheckoutCardChat'));
const Admin = lazy(() => import('./pages/Admin'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminMarketing = lazy(() => import('./pages/AdminMarketing'));
const AdminManager = lazy(() => import('./pages/AdminManager'));
const AdminReloadly = lazy(() => import('./pages/AdminReloadly'));
const AdminCards = lazy(() => import('./pages/AdminCards'));
const Settings = lazy(() => import('./pages/Settings'));
const Profile = lazy(() => import('./pages/Profile'));
const MyPromotions = lazy(() => import('./pages/MyPromotions'));
const OrderHistory = lazy(() => import('./pages/OrderHistory'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const NotificationDetail = lazy(() => import('./pages/NotificationDetail'));
const SignIn = lazy(() => import('./pages/SignIn'));
const SignUp = lazy(() => import('./pages/SignUp'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const RefundPolicy = lazy(() => import('./pages/RefundPolicy'));
const AMLPolicy = lazy(() => import('./pages/AMLPolicy'));
const Rates = lazy(() => import('./pages/Rates'));
const Spin = lazy(() => import('./pages/Spin'));
const UtilityBills = lazy(() => import('./pages/UtilityBills'));

function PageLoader() {
  return <AppLoader />;
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const isAdmin =
    location.pathname === '/admin' || location.pathname.startsWith('/admin/');

  // Scroll to top on route change (instant so lazy-loaded pages don’t leave the viewport mid-page/footer)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
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

  // Handle redirect result from Google OAuth (fallback only - popup is preferred). Never hang: 8s timeout.
  useEffect(() => {
    const REDIRECT_TIMEOUT_MS = 8000;
    const handleRedirectResult = async () => {
      const hash = window.location.hash;
      const search = window.location.search;
      const hasOAuthParams = hash.includes('access_token') || hash.includes('id_token') || search.includes('code=');

      try {
        const result = await Promise.race([
          getRedirectResult(auth),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), REDIRECT_TIMEOUT_MS))
        ]);
        console.log('🔵 [App] Current user after getRedirectResult:', auth.currentUser?.email || 'null');
        
        if (result && result.user) {
          const email = result.user.email;
          const displayName = result.user.displayName || email?.split('@')[0] || 'User';
          const photoURL = result.user.photoURL || undefined;
          try {
            const API_BASE = getApiBase();
            await fetch(`${API_BASE}/users/upsert`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, name: displayName, avatarUrl: photoURL })
            });
          } catch (_) {}
          window.history.replaceState(null, '', '/');
          setTimeout(() => { window.location.href = '/'; }, 300);
        } else if (hasOAuthParams) {
          setTimeout(() => {
            if (auth.currentUser) {
              window.history.replaceState(null, '', '/');
              window.location.href = '/';
            } else {
              alert('⚠️ OAuth redirect failed. Check console for redirect URI setup.');
            }
          }, 2000);
        }
      } catch (error: any) {
        if (error?.message === 'timeout') {
          console.warn('🔵 [App] getRedirectResult timed out – app loading anyway');
        }
      }
    };
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

  if (authLoading) {
    return <AppLoader />;
  }

  return (
    <div className="min-h-screen app-bg dark-theme relative">
      <div className="fixed inset-0 gaming-grid opacity-[0.07] pointer-events-none z-0" aria-hidden="true" />
      {!isAdmin && <Header />}
      <main className="min-h-screen relative z-10">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/giftcards" element={<GiftCards />} />
            <Route path="/giftcard/:id" element={<GiftCardDetail />} />
            <Route path="/crypto" element={<Crypto />} />
            <Route path="/payments" element={<DigitalWallets />} />
            <Route path="/wallets" element={<Navigate to="/payments" replace />} />
            <Route path="/tt-orders" element={<TtOrders />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/utility-bills" element={<UtilityBills />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/checkout/card-chat" element={<CheckoutCardChat />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/marketing" element={<AdminMarketing />} />
            <Route path="/admin/manager" element={<AdminManager />} />
            <Route path="/admin/reloadly" element={<AdminReloadly />} />
            <Route path="/admin/cards" element={<AdminCards />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/my-promotions" element={<MyPromotions />} />
            <Route path="/orders" element={<OrderHistory />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/rates" element={<Rates />} />
            <Route path="/spin" element={<Spin />} />
            <Route path="/notifications/:id" element={<NotificationDetail />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/refund" element={<RefundPolicy />} />
            <Route path="/aml" element={<AMLPolicy />} />
          </Routes>
        </Suspense>
      </main>
      {!isAdmin && <Footer />}
      {!isAdmin && <ChatWidget />}
      {!isAdmin && <EnableNotifications />}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <NotificationProvider>
          <Router>
            <AppContent />
          </Router>
        </NotificationProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;

