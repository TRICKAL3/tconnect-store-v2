// API Base URL Configuration
// DIRECT APPROACH: Always use the backend URL directly
// This is the most reliable method - no proxy needed

const BACKEND_URL = 'https://backend-e5399lu6s-trickals-projects.vercel.app';

export const getApiBase = (): string => {
  // Check if we're in development (localhost)
  if (typeof window === 'undefined') {
    // SSR or build time - default to localhost
    return 'http://localhost:4000';
  }

  const hostname = (window as Window).location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
  
  if (isLocalhost) {
    // Development - use localhost backend
    return 'http://localhost:4000';
  }
  
  // Production - use backend URL directly
  // The backend has CORS configured to allow all origins
  return BACKEND_URL;
};

