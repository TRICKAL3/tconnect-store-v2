import { getApiBase } from './getApiBase';
import type { CartItem } from '../context/CartContext';

export type PromotionType =
  | 'order_percent'
  | 'order_fixed'
  | 'category_percent'
  | 'category_fixed'
  | 'product_percent'
  | 'product_fixed'
  | 'buy_x_get_y';

export interface Promotion {
  id: string;
  name: string;
  description?: string;
  type: PromotionType;
  active: boolean;
  code?: string;
  startsAt?: string;
  endsAt?: string;
  minOrderUsd?: number;
  discountPercent?: number;
  discountUsd?: number;
  maxDiscountUsd?: number;
  appliesToCategory?: string;
  appliesToProductId?: string;
  appliesToProductType?: string;
  buyQuantity?: number;
  getQuantity?: number;
  stackable?: boolean;
  priority?: number;
}

export interface PromotionLine {
  id: string;
  name: string;
  discountUsd: number;
}

export interface PromotionResult {
  totalDiscountUsd: number;
  finalTotalUsd: number;
  appliedPromotions: PromotionLine[];
}

const isWithinSchedule = (promotion: Promotion, now: Date): boolean => {
  if (!promotion.active) return false;
  if (promotion.startsAt && now < new Date(promotion.startsAt)) return false;
  if (promotion.endsAt && now > new Date(promotion.endsAt)) return false;
  return true;
};

const pickTargetItems = (items: CartItem[], promotion: Promotion): CartItem[] => {
  return items.filter((item) => {
    if (promotion.appliesToProductId && item.id !== promotion.appliesToProductId) return false;
    if (promotion.appliesToCategory && item.category !== promotion.appliesToCategory) return false;
    if (promotion.appliesToProductType && item.type !== promotion.appliesToProductType) return false;
    return true;
  });
};

const getTargetSubtotal = (items: CartItem[]): number =>
  items.reduce((sum, item) => sum + item.price * item.quantity, 0);

const round2 = (value: number): number => Math.max(0, Math.round(value * 100) / 100);

export const calculatePromotionResult = (items: CartItem[], promotions: Promotion[]): PromotionResult => {
  const subtotal = getTargetSubtotal(items);
  if (subtotal <= 0 || promotions.length === 0) {
    return { totalDiscountUsd: 0, finalTotalUsd: round2(subtotal), appliedPromotions: [] };
  }

  const now = new Date();
  const eligible = promotions
    .filter((p) => isWithinSchedule(p, now))
    .filter((p) => (p.minOrderUsd || 0) <= subtotal)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  const stackableLines: PromotionLine[] = [];
  let bestExclusive: PromotionLine | null = null;

  const calculateSingle = (promotion: Promotion): number => {
    const targetItems = pickTargetItems(items, promotion);
    const targetSubtotal = getTargetSubtotal(targetItems);
    if (targetSubtotal <= 0 && promotion.type !== 'order_percent' && promotion.type !== 'order_fixed') return 0;

    let discount = 0;
    const percent = Math.max(0, promotion.discountPercent || 0) / 100;
    const fixed = Math.max(0, promotion.discountUsd || 0);

    switch (promotion.type) {
      case 'order_percent':
        discount = subtotal * percent;
        break;
      case 'order_fixed':
        discount = fixed;
        break;
      case 'category_percent':
      case 'product_percent':
        discount = targetSubtotal * percent;
        break;
      case 'category_fixed':
      case 'product_fixed':
        discount = fixed;
        break;
      case 'buy_x_get_y': {
        const buy = Math.max(1, promotion.buyQuantity || 0);
        const get = Math.max(0, promotion.getQuantity || 0);
        if (get === 0) break;
        for (const item of targetItems) {
          const group = buy + get;
          if (group <= 0) continue;
          const freeUnits = Math.floor(item.quantity / group) * get;
          discount += freeUnits * item.price;
        }
        break;
      }
      default:
        discount = 0;
    }

    if (promotion.maxDiscountUsd && promotion.maxDiscountUsd > 0) {
      discount = Math.min(discount, promotion.maxDiscountUsd);
    }
    discount = Math.min(discount, subtotal);
    return round2(discount);
  };

  for (const promotion of eligible) {
    const discount = calculateSingle(promotion);
    if (discount <= 0) continue;
    const line: PromotionLine = { id: promotion.id, name: promotion.name, discountUsd: discount };
    if (promotion.stackable) {
      stackableLines.push(line);
    } else if (!bestExclusive || discount > bestExclusive.discountUsd) {
      bestExclusive = line;
    }
  }

  const lines = [...stackableLines, ...(bestExclusive ? [bestExclusive] : [])];
  const totalDiscountUsd = round2(Math.min(subtotal, lines.reduce((sum, l) => sum + l.discountUsd, 0)));
  return {
    totalDiscountUsd,
    finalTotalUsd: round2(subtotal - totalDiscountUsd),
    appliedPromotions: lines,
  };
};

export const fetchActivePromotions = async (): Promise<Promotion[]> => {
  const res = await fetch(`${getApiBase()}/promotions`);
  if (!res.ok) throw new Error('Failed to load promotions');
  const data = await res.json();
  return Array.isArray(data) ? data : [];
};
