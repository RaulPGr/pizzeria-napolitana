"use client";

import Link from "next/link";
import { useSubscriptionPlan } from "@/context/SubscriptionPlanContext";

export default function AdminLink() {
  const plan = useSubscriptionPlan();
  if (!plan) return null;
  return (
    <Link href="/admin" className="px-3 py-2 rounded hover:opacity-80">
      Admin
    </Link>
  );
}
