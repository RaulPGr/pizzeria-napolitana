// src/lib/plan.ts
export type Plan = 'starter' | 'premium';

export const PLAN: Plan =
  (process.env.NEXT_PUBLIC_PLAN as Plan) || 'premium';

export const FEATURES = {
  products: ['starter', 'premium'],
  orders:   ['premium'],
  stats:    ['premium'],
  payments: ['premium'],
} as const;

export type FeatureName = keyof typeof FEATURES;

export function hasFeature(feature: FeatureName, plan: Plan = PLAN) {
  const list = FEATURES[feature] as readonly Plan[]; // ← esta línea faltaba
  return list.includes(plan);
}

