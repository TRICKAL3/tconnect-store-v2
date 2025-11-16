// API Base URL Configuration
// Uses environment variable first, then falls back to hardcoded URL

export const getApiBase = (): string => {
  // Priority 1: Environment variable (set in Vercel - MOST RELIABLE)
  if (process.env.REACT_APP_API_BASE) {
    return process.env.REACT_APP_API_BASE;
  }

  // Check if we're in development (localhost)
  if (typeof window === 'undefined') {
    return 'http://localhost:4000';
  }

  const hostname = (window as Window).location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
  
  if (isLocalhost) {
    // Development - use localhost backend
    return 'http://localhost:4000';
  }
  
  // Priority 2: Hardcoded fallback (UPDATE THIS with your current backend URL)
  // Get this from: Vercel Dashboard → Backend Project → Copy the URL
  const FALLBACK_BACKEND_URL = 'https://tconnect-backend-2k8q7yzk6-trickals-projects.vercel.app';
  
  console.warn('⚠️ [API] Using hardcoded backend URL. Set REACT_APP_API_BASE in Vercel for better reliability!');
  return FALLBACK_BACKEND_URL;
};

