import { getApiBase } from '../lib/getApiBase';

export type ProductRateType = 'crypto' | 'giftcard' | 'wallet';

// Cache for rates
let ratesCache: Record<ProductRateType, number> = {
  crypto: 1800,
  giftcard: 1900,
  wallet: 1850
};

let ratesCacheTime = 0;
const CACHE_DURATION = 30 * 1000; // 30 seconds - refresh more frequently to see admin changes

async function fetchRatesFromAPI(): Promise<void> {
  try {
    const API_BASE = getApiBase();
    console.log('📊 [Rates] Fetching rates from:', `${API_BASE}/rates`);
    
    const res = await fetch(`${API_BASE}/rates`);
    console.log('📊 [Rates] Response status:', res.status);
    
    if (res.ok) {
      const rates = await res.json();
      console.log('✅ [Rates] Rates loaded:', rates.length, 'rate entries');
      
      // Get latest rate for each type
      const latestRates: Record<string, number> = {};
      rates.forEach((rate: any) => {
        if (!latestRates[rate.type] || new Date(rate.createdAt) > new Date(latestRates[rate.type + '_date'] || 0)) {
          latestRates[rate.type] = rate.value;
          latestRates[rate.type + '_date'] = rate.createdAt;
        }
      });
      if (latestRates.crypto) ratesCache.crypto = latestRates.crypto;
      if (latestRates.giftcard) ratesCache.giftcard = latestRates.giftcard;
      if (latestRates.wallet) ratesCache.wallet = latestRates.wallet;
      ratesCacheTime = Date.now();
      console.log('✅ [Rates] Updated cache:', ratesCache);
    } else {
      const errorText = await res.text();
      console.error('❌ [Rates] Failed to fetch rates:', res.status, errorText);
    }
  } catch (error: any) {
    console.error('❌ [Rates] Error fetching rates from API, using cached/default values:', error.message);
    console.error('❌ [Rates] API Base URL:', process.env.REACT_APP_API_BASE || 'http://localhost:4000');
  }
}

export function getMwkAmountFromUsd(usdAmount: number, type: ProductRateType): number {
  // Refresh cache if it's old (async, non-blocking)
  if (Date.now() - ratesCacheTime > CACHE_DURATION) {
    fetchRatesFromAPI(); // This will update the cache in the background
  }
  const rate = ratesCache[type] || 1800; // Fallback to default if not loaded yet
  return Math.max(0, Math.round(usdAmount * rate));
}

// Export function to force refresh rates (can be called from admin after updating)
export async function refreshRates(): Promise<void> {
  ratesCacheTime = 0; // Reset cache time to force refresh
  await fetchRatesFromAPI();
}

// Initialize rates on first load
if (typeof window !== 'undefined') {
  fetchRatesFromAPI();
  // Expose refresh function globally so admin can trigger it
  (window as any).refreshRates = refreshRates;
}


