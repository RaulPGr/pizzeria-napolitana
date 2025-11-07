export type SubscriptionPlan = "starter" | "medium" | "premium";

export function normalizeSubscriptionPlan(input: unknown): SubscriptionPlan {
  const raw = String(input ?? "").trim().toLowerCase();
  if (raw === "starter") return "starter";
  if (raw === "medium") return "medium";
  if (raw === "premium") return "premium";
  return "premium";
}

export function subscriptionAllowsOrders(plan: SubscriptionPlan): boolean {
  return plan === "premium";
}

export function subscriptionAllowsReservations(plan: SubscriptionPlan): boolean {
  return plan === "medium" || plan === "premium";
}
