import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

// Log all fetch requests for debugging (only in development, and with error handling)
if (process.env.NODE_ENV === 'development') {
  try {
    const originalFetch = window.fetch;
    (window as any).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const url = typeof input === 'string' ? input : input.toString();
        const options = init || {};
        let bodyPreview = undefined;
        try {
          if (options.body && typeof options.body === 'string') {
            bodyPreview = JSON.parse(options.body);
          } else {
            bodyPreview = options.body;
          }
        } catch {}
        
        console.log('🌐 FETCH REQUEST:', {
          url,
          method: options.method || 'GET',
          body: bodyPreview
        });
        
        const response = await originalFetch(input, init);
        const clonedResponse = response.clone();
        
        // Try to read response as JSON, fallback to text (non-blocking)
        clonedResponse.text().then((text) => {
          try {
            const json = JSON.parse(text);
            console.log('🌐 FETCH RESPONSE:', {
              url,
              status: response.status,
              statusText: response.statusText,
              body: json
            });
          } catch {
            console.log('🌐 FETCH RESPONSE:', {
              url,
              status: response.status,
              statusText: response.statusText,
              body: text.substring(0, 200)
            });
          }
        }).catch(() => {});
        
        return response;
      } catch (error) {
        console.error('🌐 FETCH ERROR:', error);
        // Fallback to original fetch if override fails
        return originalFetch(input, init);
      }
    };
  } catch (error) {
    console.error('Failed to override fetch:', error);
    // Continue without fetch override
  }
}

// Register Service Worker for background notifications (completely non-blocking)
// Do this after React has rendered to avoid blocking
if ('serviceWorker' in navigator) {
  // Wait for page to fully load, then register in background
  if (document.readyState === 'complete') {
    // Page already loaded, register immediately but async
    setTimeout(() => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('✅ Service Worker registered:', registration.scope);
        })
        .catch((error) => {
          console.log('⚠️ Service Worker registration failed (non-critical):', error);
          // Silently fail - don't block app
        });
    }, 1000);
  } else {
    // Wait for page load
    window.addEventListener('load', () => {
      setTimeout(() => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('✅ Service Worker registered:', registration.scope);
          })
          .catch((error) => {
            console.log('⚠️ Service Worker registration failed (non-critical):', error);
            // Silently fail - don't block app
          });
      }, 1000);
    });
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
