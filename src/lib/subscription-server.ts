"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeSubscriptionPlan, type SubscriptionPlan } from "./subscription";

export type SubscriptionInfo = { plan: SubscriptionPlan; ordersEnabled: boolean };

export async function getSubscriptionForSlug(slug: string): Promise<SubscriptionInfo> {
  const safeSlug = (slug || "").trim();
  if (!safeSlug) return { plan: "premium", ordersEnabled: true };
  try {
    const { data, error } = await supabaseAdmin
      .from("businesses")
      .select("theme_config, social")
      .eq("slug", safeSlug)
      .maybeSingle();
    if (error) return { plan: "premium", ordersEnabled: true };
    const theme = (data as any)?.theme_config ?? null;
    const plan = normalizeSubscriptionPlan(theme?.subscription);
    const social = (data as any)?.social || {};
    const ordersEnabled = social?.orders_enabled !== false;
    return { plan, ordersEnabled };
  } catch {
    return { plan: "premium", ordersEnabled: true };
  }
}
