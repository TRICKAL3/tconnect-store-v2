// API Base URL Configuration
// UNIFIED APPROACH: API is now in the same project, so we use relative paths
// This eliminates CORS issues and URL problems!

export const getApiBase = (): string => {
  // Check if we're in development (localhost)
  if (typeof window === 'undefined') {
    // Server-side rendering or build time - use localhost
    return 'http://localhost:4000';
  }

  const hostname = (window as Window).location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
  
  if (isLocalhost) {
    // Development - use localhost backend (if running separately)
    // Or use /api if you want to test with the unified setup
    return 'http://localhost:4000';
  }
  
  // Production - API is in the same domain, use relative path
  // This means: https://yourdomain.com/api/products
  // No CORS issues, no URL problems!
  return '/api';
};

