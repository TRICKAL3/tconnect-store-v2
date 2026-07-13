/** Fixed 9-slot wheel: slots 0 & 4 = green no-win (no letter). Slots 1,2,3,5,6,7,8 = prizes with letters. */

export const WHEEL_SLOT_COUNT = 9;
export const NO_WIN_SLOT_INDEXES = [0, 4] as const;
export const PRIZE_SLOT_INDEXES = [1, 2, 3, 5, 6, 7, 8] as const;
export const DEFAULT_PRIZE_LETTERS = ['B', 'C', 'D', 'F', 'G', 'H', 'I'] as const;

export function isNoWinSlot(slotIndex: number): boolean {
  return slotIndex === 0 || slotIndex === 4;
}

export function wheelColorForSlot(slotIndex: number): 'green' | 'red' | 'black' {
  if (isNoWinSlot(slotIndex)) return 'green';
  const prizeIdx = (PRIZE_SLOT_INDEXES as readonly number[]).indexOf(slotIndex);
  return prizeIdx % 2 === 0 ? 'red' : 'black';
}

export function wheelShowsLetterOnSlot(slotIndex: number): boolean {
  return !isNoWinSlot(slotIndex);
}

type PrizeLike = { sortOrder: number; rewardType: string; label: string };

/** Wheel order is always sortOrder 0..8. Slots 0 & 4 must be no_win; other 7 must be prizes. */
export function orderWheelBySlots<T extends PrizeLike>(prizes: T[]): T[] | null {
  if (prizes.length !== WHEEL_SLOT_COUNT) return null;
  const bySort = new Map(prizes.map((p) => [p.sortOrder, p]));
  const ordered: T[] = [];
  for (let i = 0; i < WHEEL_SLOT_COUNT; i++) {
    const row = bySort.get(i);
    if (!row) return null;
    ordered.push(row);
  }
  if (ordered[0].rewardType !== 'no_win' || ordered[4].rewardType !== 'no_win') return null;
  for (const idx of PRIZE_SLOT_INDEXES) {
    if (ordered[idx].rewardType === 'no_win') return null;
  }
  return ordered;
}

export function wheelLayoutOk(prizes: { rewardType: string; sortOrder: number }[]): boolean {
  return orderWheelBySlots(prizes) !== null;
}

export function defaultLetterForPrizeSlot(slotIndex: number): string {
  const idx = (PRIZE_SLOT_INDEXES as readonly number[]).indexOf(slotIndex);
  return DEFAULT_PRIZE_LETTERS[idx] ?? 'P';
}
