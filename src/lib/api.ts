import { getApiBase } from './getApiBase';

// Get API base dynamically (not at module load time)
// This ensures the meta tag is read after DOM is ready
const getApiBaseUrl = (): string => {
  const apiBase = getApiBase();
  
  // Log API base URL (only once per session)
  if (typeof window !== 'undefined' && !(window as any).__apiBaseLogged) {
    console.log('🔧 [API] API Base URL:', apiBase);
    if (apiBase.includes('localhost') && window.location.hostname !== 'localhost') {
      console.warn('⚠️ [API] WARNING: Using localhost API URL in production!');
    }
    (window as any).__apiBaseLogged = true;
  }
  
  return apiBase;
};

export interface ApiProduct {
  id: string;
  name: string;
  category: string;
  type: 'giftcard' | 'crypto' | 'wallet' | 'virtual-card' | string;
  priceUsd: number;
  image?: string;
  description?: string;
  inStock: boolean;
}

export interface ApiRate {
  id: string;
  type: 'giftcard' | 'crypto' | 'wallet' | string;
  value: number;
}

export async function fetchProducts(): Promise<ApiProduct[]> {
  const res = await fetch(`${getApiBaseUrl()}/products`);
  if (!res.ok) throw new Error('Failed to load products');
  return res.json();
}

export async function fetchRates(): Promise<ApiRate[]> {
  const res = await fetch(`${getApiBaseUrl()}/rates`);
  if (!res.ok) throw new Error('Failed to load rates');
  return res.json();
}


