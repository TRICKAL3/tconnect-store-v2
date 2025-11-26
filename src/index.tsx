import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Log all fetch requests for debugging
const originalFetch = window.fetch;
(window as any).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
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
  
  try {
    const response = await originalFetch(input, init);
    const clonedResponse = response.clone();
    
    // Try to read response as JSON, fallback to text
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
    console.error('🌐 FETCH ERROR:', url, error);
    throw error;
  }
};

// Register Service Worker for background notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('✅ Service Worker registered:', registration.scope);
      })
      .catch((error) => {
        console.log('⚠️ Service Worker registration failed:', error);
      });
  });
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
