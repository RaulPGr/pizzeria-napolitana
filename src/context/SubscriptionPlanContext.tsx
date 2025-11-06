"use client";

import { createContext, useContext } from "react";
import type { SubscriptionPlan } from "@/lib/subscription";

const SubscriptionPlanContext = createContext<SubscriptionPlan>("premium");

type Props = {
  plan: SubscriptionPlan;
  children: React.ReactNode;
};

export function SubscriptionPlanProvider({ plan, children }: Props) {
  return <SubscriptionPlanContext.Provider value={plan}>{children}</SubscriptionPlanContext.Provider>;
}

export function useSubscriptionPlan(): SubscriptionPlan {
  return useContext(SubscriptionPlanContext);
}

