"use client";

import type { CartItem } from "@/lib/cart-storage";

export type Promotion = {
  id: string;
  name: string;
  description?: string | null;
  type: "percent" | "fixed";
  value: number;
  scope: "order" | "category" | "product";
  target_category_id?: number | null;
  target_product_id?: number | null;
  min_amount?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  weekdays?: number[] | null;
  active?: boolean;
};

export type PromotionResult = {
  subtotal: number;
  discount: number;
  total: number;
  promotion: Promotion | null;
};

function jsToIsoDay(date: Date) {
  const js = date.getDay(); // 0 (domingo) - 6 (sábado)
  return ((js + 6) % 7) + 1; // 1=lunes ... 7=domingo
}

function isPromotionActive(promo: Promotion, reference = new Date()): boolean {
  if (promo.active === false) return false;
  if (promo.start_date) {
    const start = new Date(promo.start_date);
    start.setHours(0, 0, 0, 0);
    if (reference < start) return false;
  }
  if (promo.end_date) {
    const end = new Date(promo.end_date);
    end.setHours(23, 59, 59, 999);
    if (reference > end) return false;
  }
  const weekdays = Array.isArray(promo.weekdays) && promo.weekdays.length > 0 ? promo.weekdays : [1, 2, 3, 4, 5, 6, 7];
  const isoDay = jsToIsoDay(reference);
  return weekdays.includes(isoDay);
}

function calculateEligibleAmount(promo: Promotion, items: CartItem[]): number {
  if (promo.scope === "category") {
    const catId = promo.target_category_id;
    if (catId == null) return 0;
    return items.reduce((sum, item) => (item.category_id === catId ? sum + item.price * item.qty : sum), 0);
  }
  if (promo.scope === "product") {
    const productId = promo.target_product_id;
    if (productId == null) return 0;
    return items.reduce((sum, item) => (String(item.id) === String(productId) ? sum + item.price * item.qty : sum), 0);
  }
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function calculateDiscount(promo: Promotion, amount: number): number {
  if (amount <= 0) return 0;
  const value = Number(promo.value || 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (promo.type === "percent") {
    const pct = Math.min(Math.max(value, 0), 100);
    return (amount * pct) / 100;
  }
  return Math.min(value, amount);
}

export function applyBestPromotion(items: CartItem[], promotions: Promotion[], options?: { now?: Date }): PromotionResult {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  if (subtotal <= 0 || promotions.length === 0) {
    return { subtotal, discount: 0, total: subtotal, promotion: null };
  }
  const reference = options?.now ?? new Date();
  let bestDiscount = 0;
  let bestPromotion: Promotion | null = null;

  for (const promo of promotions) {
    if (!isPromotionActive(promo, reference)) continue;
    const eligibleAmount = calculateEligibleAmount(promo, items);
    if (eligibleAmount <= 0) continue;
    const minAmount = Number(promo.min_amount ?? 0);
    if (subtotal < Math.max(0, minAmount)) continue;
    const discount = calculateDiscount(promo, eligibleAmount);
    if (discount > bestDiscount) {
      bestDiscount = discount;
      bestPromotion = promo;
    }
  }

  const total = Math.max(0, subtotal - bestDiscount);
  return { subtotal, discount: bestDiscount, total, promotion: bestPromotion };
}
