"use client";

import { createContext, useContext, useMemo } from "react";
import type { SubscriptionPlan } from "@/lib/subscription";

type AdminAccess = {
  plan: SubscriptionPlan;
  isSuper: boolean;
};

const AdminAccessContext = createContext<AdminAccess>({ plan: "premium", isSuper: false });

type Props = AdminAccess & { children: React.ReactNode };

// Contexto que expone el plan contratado y si el usuario es superadmin.
export function AdminAccessProvider({ plan, isSuper, children }: Props) {
  const value = useMemo(() => ({ plan, isSuper }), [plan, isSuper]);
  return <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>;
}

// Hook corto para consumir el plan actual en cualquier componente del admin.
export function useAdminAccess(): AdminAccess {
  return useContext(AdminAccessContext);
}

