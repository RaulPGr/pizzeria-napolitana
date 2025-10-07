// src/lib/plan.ts
export type Plan = 'starter' | 'medium' | 'pro';

export const PLAN: Plan =
  (process.env.NEXT_PUBLIC_PLAN as Plan) || 'starter';

// qué plan puede ver cada feature/sección
export const FEATURES = {
  products: ['starter', 'medium', 'pro'],
  orders:   ['medium', 'pro'],
  stats:    ['medium', 'pro'],
  payments: ['pro'],
} as const;

export type FeatureName = keyof typeof FEATURES;

export function hasFeature(feature: FeatureName, plan: Plan = PLAN) {
  return FEATURES[feature].includes(plan);
}
