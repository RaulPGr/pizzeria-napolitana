"use client";

import Link from "next/link";
import { useSubscriptionPlan } from "@/context/SubscriptionPlanContext";

export default function AdminCTA() {
  const plan = useSubscriptionPlan();
  if (!plan) return null;
  return (
    <Link
      href="/admin"
      className="rounded-xl bg-gradient-to-r from-orange-500 to-green-600 px-4 py-2 text-white font-medium hover:opacity-90"
    >
      Panel
    </Link>
  );
}
