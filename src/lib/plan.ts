// src/lib/plan.ts
export type Plan = "starter" | "medium" | "premium";

export const PLAN: Plan = (process.env.NEXT_PUBLIC_PLAN as Plan) || "premium";

export const FEATURES = {
  products: ["starter", "medium", "premium"],
  orders: ["premium"],
  stats: ["premium"],
  payments: ["premium"],
} as const;

export type FeatureName = keyof typeof FEATURES;

export function hasFeature(feature: FeatureName, plan: Plan = PLAN) {
  const list = FEATURES[feature] as readonly Plan[];
  return list.includes(plan);
}
