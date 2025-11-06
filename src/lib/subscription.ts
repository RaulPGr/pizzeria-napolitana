export type SubscriptionPlan = "starter" | "premium";

export function normalizeSubscriptionPlan(input: unknown): SubscriptionPlan {
  const raw = String(input ?? "").trim().toLowerCase();
  if (raw === "starter" || raw === "medium") return "starter";
  if (raw === "premium") return "premium";
  return "premium";
}

export function subscriptionAllowsOrders(plan: SubscriptionPlan): boolean {
  return plan === "premium";
}
