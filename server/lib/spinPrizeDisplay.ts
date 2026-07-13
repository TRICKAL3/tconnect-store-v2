/** Wheel shows a short letter; legend / results use full prize description. */

export function normalizeWheelLetter(label: string): string {
  const t = String(label || '').trim();
  if (!t) return '?';
  const letter = t.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase();
  return letter || '?';
}

export function spinProductPrizeUsd(p: {
  prizeAmountUsd?: number | null;
  product?: { priceUsd?: number } | null;
}): number | null {
  const custom = p.prizeAmountUsd;
  if (custom != null && Number.isFinite(Number(custom)) && Number(custom) > 0) {
    return Number(custom);
  }
  const catalog = p.product?.priceUsd;
  if (catalog != null && Number(catalog) > 0) return Number(catalog);
  return null;
}

export function describeSpinPrize(p: {
  label: string;
  rewardType: string;
  points: number;
  prizeAmountUsd?: number | null;
  product?: { name: string; type?: string; priceUsd?: number } | null;
}): string {
  const rt = String(p.rewardType || '').trim();
  if (rt === 'no_win') return 'No win';
  if (rt === 'points' && p.points > 0) {
    return `${p.points.toLocaleString()} TConnect points`;
  }
  if (rt === 'product' && p.product?.name) {
    const usd = spinProductPrizeUsd(p);
    if (usd != null) return `${p.product.name} ($${usd} USD)`;
    return p.product.name;
  }
  return 'Prize';
}
