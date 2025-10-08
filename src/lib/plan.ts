// src/lib/plan.ts
export type Plan = 'starter' | 'medium' | 'pro';

export const PLAN: Plan =
  (process.env.NEXT_PUBLIC_PLAN as Plan) || 'starter';

export const FEATURES = {
  products: ['starter', 'medium', 'pro'],
  orders:   ['medium', 'pro'],
  stats:    ['medium', 'pro'],
  payments: ['pro'],
} as const;

export type FeatureName = keyof typeof FEATURES;

export function hasFeature(feature: FeatureName, plan: Plan = PLAN) {
  const list = FEATURES[feature] as readonly Plan[]; // ← esta línea faltaba
  return list.includes(plan);
}

