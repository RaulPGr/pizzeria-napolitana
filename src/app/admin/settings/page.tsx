"use client";

import SettingsClient from "./settingsClient";
import BusinessSettingsClient from "@/app/admin/settings/business/client.clean";
import OrdersHoursSettingsClient from "@/app/admin/settings/orders/client";
import { useAdminAccess } from "@/context/AdminAccessContext";
import { subscriptionAllowsOrders } from "@/lib/subscription";

export default function SettingsPage() {
  const { plan, isSuper } = useAdminAccess();
  const allowOrdersFeatures = subscriptionAllowsOrders(plan) || isSuper;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <details className="rounded-lg border bg-white shadow-sm">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">Configuracion del negocio</summary>
        <div className="p-4">
          <BusinessSettingsClient />
        </div>
      </details>

      {allowOrdersFeatures && (
        <details className="rounded-lg border bg-white shadow-sm">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">Configuracion de pagos</summary>
          <div className="p-4">
            <SettingsClient />
          </div>
        </details>
      )}

      {allowOrdersFeatures && (
        <details className="rounded-lg border bg-white shadow-sm">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
            Configuracion horario de pedidos
          </summary>
          <div className="p-4">
            <OrdersHoursSettingsClient />
          </div>
        </details>
      )}
    </div>
  );
}
