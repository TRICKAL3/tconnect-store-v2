import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

// Optional: set REACT_APP_DEBUG_FETCH=1 in .env to log fetch (adds latency)
if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_FETCH === '1') {
  try {
    const originalFetch = window.fetch;
    (window as any).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await originalFetch(input, init);
      const url = typeof input === 'string' ? input : input.toString();
      console.log('🌐', response.status, url);
      return response;
    };
  } catch (_) {}
}

// Register Service Worker only in PRODUCTION (dev server often fails to serve sw.js)
// SKIP Service Worker on iOS to avoid all notification issues
const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !isIOSDevice && 'serviceWorker' in navigator) {
  if (document.readyState === 'complete') {
    setTimeout(() => {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
        .then((registration) => {
          console.log('✅ Service Worker registered:', registration.scope);
          registration.update();
        })
        .catch((err) => console.warn('Service Worker registration failed:', err));
    }, 1000);
  } else {
    window.addEventListener('load', () => {
      setTimeout(() => {
        navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
          .then((registration) => {
            console.log('✅ Service Worker registered:', registration.scope);
            registration.update();
          })
          .catch((err) => console.warn('Service Worker registration failed:', err));
      }, 1000);
    });
  }
} else if (!isProduction) {
  // In development: unregister any existing SW so it doesn't cause errors
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister().catch(() => {}));
    }).catch(() => {});
  }
} else if (isIOSDevice) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister().catch(() => {}));
    }).catch(() => {});
  }
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
