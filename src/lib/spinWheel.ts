/** SVG wheel geometry + label fitting for Spin To Win. */



export const WHEEL_SIZE = 320;

export const WHEEL_CX = WHEEL_SIZE / 2;

export const WHEEL_CY = WHEEL_SIZE / 2;

export const WHEEL_R = 142;



export const WHEEL_COLOR_GREEN = '#22c55e';



/** One distinct color per prize slice (7 on a 9-slice wheel). */

export const WHEEL_PRIZE_COLORS = [

  '#ef4444',

  '#3b82f6',

  '#a855f7',

  '#f59e0b',

  '#06b6d4',

  '#ec4899',

  '#f97316',

] as const;



export const WHEEL_SECTOR_COUNT = 9;



export type WheelSliceConfig = {

  rewardType?: string;

  letter?: string;

  label?: string;

  showLetter?: boolean;

  slotIndex?: number;

};



export function isNoWinWheelSlice(slice: WheelSliceConfig | null | undefined): boolean {

  if (!slice) return false;

  const rt = String(slice.rewardType || '').trim().toLowerCase();

  return rt === 'no_win' || rt === 'nowin' || rt === 'no-win';

}



export function wheelSliceShowsLetter(slice: WheelSliceConfig | null | undefined): boolean {

  if (isNoWinWheelSlice(slice)) return false;

  if (slice?.showLetter === false) return false;

  return !!wheelSliceLetter(slice?.letter || slice?.label || '');

}



export function wheelSliceAngle(sliceCount: number): number {

  return sliceCount > 0 ? 360 / sliceCount : 360;

}



export function wheelSliceLetter(label: string): string {

  const t = String(label || '').trim();

  if (!t) return '';

  return t.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '';

}



export function wheelLetterFontSize(sliceCount: number): number {

  if (sliceCount === 9) return 16;

  if (sliceCount <= 7) return 17;

  return 15;

}



export const WHEEL_LETTER_RADIUS_RATIO = 0.52;



export function wheelPrizeColorIndex(index: number, slices: WheelSliceConfig[]): number {

  let prizeIndex = 0;

  for (let j = 0; j < index; j++) {

    if (!isNoWinWheelSlice(slices[j])) prizeIndex++;

  }

  return prizeIndex;

}



export function wheelSectorFill(slice: WheelSliceConfig, index: number, slices: WheelSliceConfig[]): string {

  if (isNoWinWheelSlice(slice)) return WHEEL_COLOR_GREEN;

  const prizeIndex = wheelPrizeColorIndex(index, slices);

  return WHEEL_PRIZE_COLORS[prizeIndex % WHEEL_PRIZE_COLORS.length];

}



/**
 * Clockwise CSS rotation (deg) so slice `index` center sits under the top pointer.
 * Wheel slices use 0° = top; center = index * sliceAngle + sliceAngle/2 - 90 in path coords.
 */
export function wheelRotationDegreesForSlice(index: number, sliceCount: number): number {
  const sliceAngle = wheelSliceAngle(sliceCount);
  const centerFromTop = index * sliceAngle + sliceAngle / 2;
  return (90 - centerFromTop + 360) % 360;
}



export function wheelSectorTextFill(fill: string, highlighted: boolean): string {

  if (highlighted) return '#fef08a';

  if (fill === WHEEL_COLOR_GREEN) return '#ecfdf5';

  return '#ffffff';

}



export function wheelSectorPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {

  const toRad = (d: number) => (d * Math.PI) / 180;

  const x1 = cx + r * Math.sin(toRad(startDeg));

  const y1 = cy - r * Math.cos(toRad(startDeg));

  const x2 = cx + r * Math.sin(toRad(endDeg));

  const y2 = cy - r * Math.cos(toRad(endDeg));

  const large = endDeg - startDeg > 180 ? 1 : 0;

  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;

}



export function wheelDividerEndpoints(

  cx: number,

  cy: number,

  r: number,

  angleDeg: number

): { x1: number; y1: number; x2: number; y2: number } {

  const toRad = (d: number) => (d * Math.PI) / 180;

  return {

    x1: cx,

    y1: cy,

    x2: cx + r * Math.sin(toRad(angleDeg)),

    y2: cy - r * Math.cos(toRad(angleDeg)),

  };

}


