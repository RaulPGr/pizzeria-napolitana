"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeSubscriptionPlan, type SubscriptionPlan } from "./subscription";

export async function getSubscriptionForSlug(slug: string): Promise<SubscriptionPlan> {
  const safeSlug = (slug || "").trim();
  if (!safeSlug) return "premium";
  try {
    const { data, error } = await supabaseAdmin
      .from("businesses")
      .select("theme_config")
      .eq("slug", safeSlug)
      .maybeSingle();
    if (error) return "premium";
    const theme = (data as any)?.theme_config ?? null;
    return normalizeSubscriptionPlan(theme?.subscription);
  } catch {
    return "premium";
  }
}

