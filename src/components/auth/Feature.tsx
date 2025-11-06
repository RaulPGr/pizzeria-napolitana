"use client";

import type { FeatureName } from "@/lib/plan";
import { hasFeature } from "@/lib/plan";
import UpgradeCTA from "@/components/billing/UpgradeCTA";
import { useSubscriptionPlan } from "@/context/SubscriptionPlanContext";

export default function Feature({
  name,
  children,
}: {
  name: FeatureName;
  children: React.ReactNode;
}) {
  const plan = useSubscriptionPlan();
  if (hasFeature(name, plan)) return <>{children}</>;

  return (
    <div className="p-6 border rounded bg-white">
      <p className="mb-3">Esta sección pertenece a un plan superior.</p>
      <UpgradeCTA />
    </div>
  );
}

