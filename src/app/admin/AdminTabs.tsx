"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import LogoutButton from "@/components/LogoutButton";
import { useAdminAccess } from "@/context/AdminAccessContext";
import { subscriptionAllowsOrders, subscriptionAllowsReservations } from "@/lib/subscription";

// Barra de pestañas del panel admin, adaptada a los permisos del negocio.
export default function AdminTabs() {
  const pathname = usePathname();
  const isOrders = pathname?.startsWith("/admin/orders");
  const isPromotions = pathname?.startsWith("/admin/promotions");
  const isOptions = pathname?.startsWith("/admin/options");
  const isReservations = pathname?.startsWith("/admin/reservations");
  const isSettings = pathname?.startsWith("/admin/settings");
  const isStats = pathname?.startsWith("/admin/stats");
  const { plan, isSuper } = useAdminAccess();
  const canSeeOrders = subscriptionAllowsOrders(plan) || isSuper;
  const canSeeReservations = subscriptionAllowsReservations(plan) || isSuper;
  const canSeeStats = plan === "premium" || isSuper;

  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-2 overflow-x-auto rounded-full bg-white/70 px-2 py-2 shadow-sm md:bg-transparent md:shadow-none">
        <Link
          href="/admin"
          className={clsx(
            "inline-flex items-center rounded-full border px-4 py-2 text-sm whitespace-nowrap",
            !isOrders && !isSettings && !isStats && !isPromotions && !isOptions ? "bg-black text-white" : "bg-white"
          )}
        >
          Productos
        </Link>

        <Link
          href="/admin/promotions"
          className={clsx(
            "inline-flex items-center rounded-full border px-4 py-2 text-sm whitespace-nowrap",
            isPromotions ? "bg-black text-white" : "bg-white"
          )}
        >
          Promociones
        </Link>

        <Link
          href="/admin/options"
          className={clsx(
            "inline-flex items-center rounded-full border px-4 py-2 text-sm whitespace-nowrap",
            isOptions ? "bg-black text-white" : "bg-white"
          )}
        >
          Toppings
        </Link>

        {canSeeOrders && (
          <Link
            href="/admin/orders"
            className={clsx(
              "inline-flex items-center rounded-full border px-4 py-2 text-sm whitespace-nowrap",
              isOrders ? "bg-black text-white" : "bg-white"
            )}
          >
            Pedidos
          </Link>
        )}
        {canSeeReservations && (
          <Link
            href="/admin/reservations"
            className={clsx(
              "inline-flex items-center rounded-full border px-4 py-2 text-sm whitespace-nowrap",
              isReservations ? "bg-black text-white" : "bg-white"
            )}
          >
            Reservas
          </Link>
        )}

        <Link
          href="/admin/settings"
          className={clsx(
            "inline-flex items-center rounded-full border px-4 py-2 text-sm whitespace-nowrap",
            isSettings ? "bg-black text-white" : "bg-white"
          )}
        >
          Configuracion
        </Link>

        {canSeeStats && (
          <Link
            href="/admin/stats"
            className={clsx(
              "inline-flex items-center rounded-full border px-4 py-2 text-sm whitespace-nowrap",
              isStats ? "bg-black text-white" : "bg-white"
            )}
          >
            Estadisticas
          </Link>
        )}
      </div>

      <div className="flex justify-end">
        <LogoutButton />
      </div>
    </div>
  );
}
