"use client";

import { createContext, useContext } from "react";

// Indica si el negocio tiene los pedidos online activos (carrito visible).
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

// Exposición simple para saber si el negocio acepta pedidos online actualmente.
export function useOrdersEnabled(): boolean {
  return useContext(OrdersEnabledContext);
}
