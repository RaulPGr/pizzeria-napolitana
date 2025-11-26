"use client";

import { createContext, useContext } from "react";
import type { SubscriptionPlan } from "@/lib/subscription";

const SubscriptionPlanContext = createContext<SubscriptionPlan>("premium");

type Props = {
  plan: SubscriptionPlan;
  children: React.ReactNode;
};

// Contexto global con el plan del negocio (Starter/Medium/Premium).
export function SubscriptionPlanProvider({ plan, children }: Props) {
  return <SubscriptionPlanContext.Provider value={plan}>{children}</SubscriptionPlanContext.Provider>;
}

// Hook auxiliar para consultar el plan sin rehacer props en cada componente.
export function useSubscriptionPlan(): SubscriptionPlan {
  return useContext(SubscriptionPlanContext);
}

