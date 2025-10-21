// src/app/admin/settings/business/page.tsx
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import BusinessSettingsClient from './client.clean';

export default function BusinessSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <BusinessSettingsClient />
    </div>
  );
}
