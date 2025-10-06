"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin",        label: "Productos" },
  { href: "/admin/orders", label: "Pedidos" },
  { href: "/admin/stats",  label: "Estadísticas" },
  { href: "/admin/pagos",  label: "Pagos" }, // 👈 NUEVA PESTAÑA
];

export default function AdminTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 border-b">
      <nav className="-mb-px flex gap-6">
        {TABS.map((t) => {
          const active =
            pathname === t.href ||
            (t.href !== "/admin" && pathname?.startsWith(t.href));

          return (
            <Link
              key={t.href}
              href={t.href}
              className={`pb-2 border-b-2 ${
                active
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
