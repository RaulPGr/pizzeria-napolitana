// src/app/admin/layout.tsx
import AdminTabs from "./AdminTabs";
import NewOrderSound from "@/components/NewOrderSound";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminEmails } from "@/utils/plan";
import { AdminAccessProvider } from "@/context/AdminAccessContext";
import { getSubscriptionForSlug } from "@/lib/subscription-server";
import type { SubscriptionPlan } from "@/lib/subscription";

type AdminAccessState = {
  allowed: boolean;
  isSuper: boolean;
  plan: SubscriptionPlan;
};

async function getAdminAccess(): Promise<AdminAccessState> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host");
  const baseUrl = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");
  const cookie = h.get("cookie") ?? "";

  let email = "";
  let isMember = false;
  try {
    const res = await fetch(`${baseUrl}/api/whoami`, { cache: "no-store", headers: { cookie } });
    if (res.ok) {
      const j = await res.json();
      email = String(j?.email || "").toLowerCase();
      isMember = !!j?.isMember;
    }
  } catch {}

  const admins = adminEmails();
  const isSuper = admins.length === 0 ? !!email : admins.includes(email);
  const allowed = isSuper || isMember;

  let plan: SubscriptionPlan = "premium";
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get("x-tenant-slug")?.value || "";
    if (slug) plan = await getSubscriptionForSlug(slug);
  } catch {}

  return { allowed, isSuper, plan };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await getAdminAccess();
  if (!access.allowed) redirect("/login");
  const limited = access.plan === "starter" && !access.isSuper;
  return (
    <AdminAccessProvider plan={access.plan} isSuper={access.isSuper}>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="mb-2 text-2xl font-semibold">Panel de Administraci�n</h1>
        <AdminTabs />
        {/* Bot�n flotante para activar sonido de nuevos pedidos */}
        {!limited && <NewOrderSound />}
        {children}
      </div>
    </AdminAccessProvider>
  );
}

