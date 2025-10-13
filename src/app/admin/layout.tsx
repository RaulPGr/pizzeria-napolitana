// src/app/admin/layout.tsx
import AdminTabs from "./AdminTabs";
import NewOrderSound from "@/components/NewOrderSound";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminEmails } from "@/utils/plan";

async function isAdmin() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host");
  const baseUrl = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");
  const cookie = h.get("cookie") ?? "";
  try {
    const res = await fetch(`${baseUrl}/api/whoami`, { cache: "no-store", headers: { cookie } });
    if (!res.ok) return false;
    const j = await res.json();
    const email = String(j?.email || "").toLowerCase();
    const admins = adminEmails();
    return admins.length === 0 ? !!email : admins.includes(email);
  } catch {
    return false;
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ok = await isAdmin();
  if (!ok) redirect("/login");
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-2 text-2xl font-semibold">Panel de Administración</h1>
      <AdminTabs />
      {/* Botón flotante para activar sonido de nuevos pedidos */}
      <NewOrderSound />
      {children}
    </div>
  );
}
