// src/app/admin/AdminTabs.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import LogoutButton from "@/components/LogoutButton";

export default function AdminTabs() {
  const pathname = usePathname();
  const isOrders = pathname?.startsWith("/admin/orders");
  const isSettings = pathname?.startsWith("/admin/settings");
  const isStats = pathname?.startsWith("/admin/stats");

  return (
    <div className="mb-6 flex items-center justify-between gap-3">
      <div className="flex gap-3">
        <Link
          href="/admin"
          className={clsx(
            "inline-flex items-center rounded-full border px-4 py-2 text-sm",
          !isOrders && !isSettings && !isStats ? "bg-black text-white" : "bg-white"
          )}
        >
          Productos
        </Link>

      <Link
        href="/admin/orders"
        className={clsx(
          "inline-flex items-center rounded-full border px-4 py-2 text-sm",
          isOrders ? "bg-black text-white" : "bg-white"
        )}
      >
        Pedidos
      </Link>

      <Link
        href="/admin/settings"
        className={clsx(
          "inline-flex items-center rounded-full border px-4 py-2 text-sm",
          isSettings ? "bg-black text-white" : "bg-white"
        )}
      >
        Configuración
      </Link>

        <Link
          href="/admin/stats"
          className={clsx(
            "inline-flex items-center rounded-full border px-4 py-2 text-sm",
            isStats ? "bg-black text-white" : "bg-white"
          )}
        >
          Estadísticas
        </Link>
      </div>

      <LogoutButton />
    </div>
  );
}
