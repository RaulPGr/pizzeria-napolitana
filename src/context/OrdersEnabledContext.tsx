"use client";

import { createContext, useContext } from "react";

const OrdersEnabledContext = createContext<boolean>(true);

export function OrdersEnabledProvider({
  value,
  children,
}: {
  value: boolean;
  children: React.ReactNode;
}) {
  return <OrdersEnabledContext.Provider value={value}>{children}</OrdersEnabledContext.Provider>;
}

export function useOrdersEnabled(): boolean {
  return useContext(OrdersEnabledContext);
}
