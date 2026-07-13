import { getFrontendBaseUrl } from './pawapay';

export type PawapayReturnPath = 'checkout' | 'wallet';

/**
 * HTTPS return URL after PawaPay Payment Page.
 * PAWAPAY_RETURN_URL can be full checkout URL; wallet uses PAWAPAY_WALLET_RETURN_URL or /wallet.
 */
export function getPawapayReturnUrlFor(path: PawapayReturnPath): { url: string | null; error?: string } {
  if (path === 'wallet') {
    const walletExplicit = String(process.env.PAWAPAY_WALLET_RETURN_URL || '').trim().replace(/\/+$/, '');
    if (walletExplicit) {
      if (!/^https:\/\//i.test(walletExplicit)) {
        return { url: null, error: 'PAWAPAY_WALLET_RETURN_URL must be HTTPS.' };
      }
      return { url: walletExplicit.includes('/wallet') ? walletExplicit : `${walletExplicit}/wallet` };
    }
    const front = getFrontendBaseUrl();
    if (!/^https:\/\//i.test(front) || /localhost|127\.0\.0\.1/i.test(front)) {
      return {
        url: null,
        error:
          'Set PAWAPAY_WALLET_RETURN_URL=https://www.tconnect.store/wallet (HTTPS) for wallet top-ups.',
      };
    }
    return { url: `${front}/wallet` };
  }

  const explicit = String(process.env.PAWAPAY_RETURN_URL || '').trim().replace(/\/+$/, '');
  if (explicit) {
    if (!/^https:\/\//i.test(explicit)) {
      return {
        url: null,
        error: 'PAWAPAY_RETURN_URL must be HTTPS (e.g. https://www.tconnect.store/checkout).',
      };
    }
    return { url: explicit.includes('/checkout') ? explicit : `${explicit}/checkout` };
  }

  const front = getFrontendBaseUrl();
  if (!/^https:\/\//i.test(front) || /localhost|127\.0\.0\.1/i.test(front)) {
    return {
      url: null,
      error:
        'PawaPay requires HTTPS return URL. Set PAWAPAY_RETURN_URL=https://www.tconnect.store/checkout',
    };
  }
  return { url: `${front}/checkout` };
}

/** @deprecated use getPawapayReturnUrlFor('checkout') */
export function getPawapayReturnUrl(): { url: string | null; error?: string } {
  return getPawapayReturnUrlFor('checkout');
}
