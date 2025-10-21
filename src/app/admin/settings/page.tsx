// src/app/admin/settings/page.tsx
import SettingsClient from './settingsClient';
import BusinessSettingsClient from '@/app/admin/settings/business/client.clean';
import OrdersHoursSettingsClient from '@/app/admin/settings/orders/client';

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <details open className="rounded-lg border bg-white shadow-sm">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">Configuración del negocio</summary>
        <div className="p-4">
          <BusinessSettingsClient />
        </div>
      </details>

      <details className="rounded-lg border bg-white shadow-sm">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">Configuración de pagos</summary>
        <div className="p-4">
          <SettingsClient />
        </div>
      </details>

      <details className="rounded-lg border bg-white shadow-sm">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">Configuración horario de pedidos</summary>
        <div className="p-4">
          <OrdersHoursSettingsClient />
        </div>
      </details>
    </div>
  );
}
