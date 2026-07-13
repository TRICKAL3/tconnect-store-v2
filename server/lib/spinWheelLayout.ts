/** Fixed 9-slice wheel: 2× green no-win + 5× hardcoded points + 2× admin custom prizes. */

export const WHEEL_SECTOR_COUNT = 9;
export const NO_WIN_COUNT = 2;
export const FIXED_POINTS_COUNT = 5;
export const CUSTOM_PRIZE_COUNT = 2;

/** Slice N always awards this many points. */
export const N_SLICE_LETTER = 'N';
export const N_SLICE_POINTS = 12;

/** Other fixed point prizes (assigned to non-N slices). */
export const OTHER_FIXED_TCONNECT_POINTS = [325, 162, 82, 1, 10] as const;

export const FIXED_TCONNECT_POINTS = [...OTHER_FIXED_TCONNECT_POINTS, N_SLICE_POINTS] as const;

/** Relative weights — total 1000 → 50% no win, 1% products, 49% points. */
export const WHEEL_WEIGHT_NO_WIN_EACH = 250;
export const WHEEL_WEIGHT_PRODUCT_EACH = 5;
export const WHEEL_WEIGHT_POINTS_EACH = 98;

const LETTER_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function randomNoWinPositions(): number[] {
  return shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, NO_WIN_COUNT).sort((a, b) => a - b);
}

export function randomPrizeLetters(count: number): string[] {
  return shuffle(LETTER_POOL).slice(0, count);
}

/** Five unique letters for fixed point slices — always includes N. */
export function fixedSliceLetters(): string[] {
  const others = shuffle(LETTER_POOL.filter((l) => l !== N_SLICE_LETTER)).slice(0, FIXED_POINTS_COUNT - 1);
  return shuffle([N_SLICE_LETTER, ...others]);
}

export type WheelSegmentKind = 'no_win' | 'points_fixed' | 'custom';

export type WheelSegmentDraft = {
  sortOrder: number;
  kind: WheelSegmentKind;
  label: string;
  rewardType: 'no_win' | 'points' | 'product';
  points: number;
  productId: string | null;
  prizeAmountUsd: number | null;
  weight: number;
};

export function isFixedPointsValue(points: number): boolean {
  return (FIXED_TCONNECT_POINTS as readonly number[]).includes(points);
}

export function segmentKindFromRow(row: {
  rewardType: string;
  points: number;
  productId: string | null;
}): WheelSegmentKind {
  if (String(row.rewardType).trim() === 'no_win') return 'no_win';
  if (String(row.rewardType).trim() === 'points' && isFixedPointsValue(row.points)) return 'points_fixed';
  return 'custom';
}

export function buildNineSliceLayout(custom: {
  productId: string;
  prizeAmountUsd: number;
  letter: string;
  weight: number;
}[]): WheelSegmentDraft[] {
  const noWinSlots = randomNoWinPositions();
  const noWinSet = new Set(noWinSlots);
  const prizeSlots = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8].filter((s) => !noWinSet.has(s)));
  const customLetters = randomPrizeLetters(CUSTOM_PRIZE_COUNT);
  const fixedLetters = fixedSliceLetters();

  const segments: WheelSegmentDraft[] = new Array(WHEEL_SECTOR_COUNT);
  let fixedLetterIdx = 0;
  let customLetterIdx = 0;
  let customIdx = 0;

  for (let slot = 0; slot < WHEEL_SECTOR_COUNT; slot++) {
    if (noWinSet.has(slot)) {
      segments[slot] = {
        sortOrder: slot,
        kind: 'no_win',
        label: '',
        rewardType: 'no_win',
        points: 0,
        productId: null,
        prizeAmountUsd: null,
        weight: WHEEL_WEIGHT_NO_WIN_EACH,
      };
      continue;
    }

    const posInPrize = prizeSlots.indexOf(slot);
    const isCustomSlot = posInPrize >= FIXED_POINTS_COUNT;

    if (isCustomSlot) {
      const c = custom[customIdx] ?? custom[0];
      customIdx++;
      segments[slot] = {
        sortOrder: slot,
        kind: 'custom',
        label: c.letter || customLetters[customLetterIdx] || 'P',
        rewardType: 'product',
        points: 0,
        productId: c.productId,
        prizeAmountUsd: c.prizeAmountUsd,
        weight: WHEEL_WEIGHT_PRODUCT_EACH,
      };
      customLetterIdx++;
    } else {
      const letter = fixedLetters[fixedLetterIdx] ?? 'P';
      fixedLetterIdx++;
      segments[slot] = {
        sortOrder: slot,
        kind: 'points_fixed',
        label: letter,
        rewardType: 'points',
        points: 0,
        productId: null,
        prizeAmountUsd: null,
        weight: WHEEL_WEIGHT_POINTS_EACH,
      };
    }
  }

  const pool = shuffle(OTHER_FIXED_TCONNECT_POINTS);
  let poolIdx = 0;
  for (const seg of segments) {
    if (seg?.kind !== 'points_fixed') continue;
    if (seg.label === N_SLICE_LETTER) {
      seg.points = N_SLICE_POINTS;
    } else {
      seg.points = pool[poolIdx] ?? 10;
      poolIdx++;
    }
  }

  return segments;
}
