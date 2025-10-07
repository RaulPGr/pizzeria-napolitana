// src/components/auth/Feature.tsx
'use client';

import type { FeatureName } from '@/lib/plan';
import { hasFeature, PLAN } from '@/lib/plan';
import UpgradeCTA from '@/components/billing/UpgradeCTA';

export default function Feature({
  name,
  children,
}: {
  name: FeatureName;
  children: React.ReactNode;
}) {
  if (hasFeature(name, PLAN)) return <>{children}</>;

  return (
    <div className="p-6 border rounded bg-white">
      <p className="mb-3">
        Esta sección pertenece a un plan superior.
      </p>
      <UpgradeCTA />
    </div>
  );
}
