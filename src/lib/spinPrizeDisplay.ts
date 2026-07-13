/** Client-side prize legend text (matches server spinPrizeDisplay). */

export function normalizeWheelLetter(label: string): string {
  const t = String(label || '').trim();
  if (!t) return '?';
  const letter = t.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase();
  return letter || '?';
}

export function describeSpinPrizeFromSlice(slice: {
  description?: string;
  rewardType?: string;
  points?: number;
  productName?: string | null;
  prizeAmountUsd?: number | null;
}): string {
  if (slice.description) return slice.description;
  const rt = String(slice.rewardType || '').trim();
  if (rt === 'no_win') return 'No win';
  if (rt === 'points' && Number(slice.points) > 0) {
    return `${Number(slice.points).toLocaleString()} TConnect points`;
  }
  if (rt === 'product' && slice.productName) {
    const usd = slice.prizeAmountUsd;
    if (usd != null && Number(usd) > 0) return `${slice.productName} ($${Number(usd)} USD)`;
    return slice.productName;
  }
  return 'Prize';
}
