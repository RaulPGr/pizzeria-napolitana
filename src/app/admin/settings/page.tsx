// src/app/admin/settings/page.tsx
import SettingsClient from './settingsClient';
import BusinessSettingsClient from '@/app/admin/settings/business/client';

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Configuración de negocio (nombre, slogan, logo/hero) */}
      <BusinessSettingsClient />

      {/* Configuración de pagos (ya existente) */}
      <SettingsClient />
    </div>
  );
}
