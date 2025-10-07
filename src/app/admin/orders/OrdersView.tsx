// src/app/admin/orders/OrdersView.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

// --- Tipos locales para evitar importar desde ./page (rompía el build) ---
type OrderItem = {
  name: string;
  quantity: number;
  line_total_cents: number;
};

type OrderWithItems = {
  id: string;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  pickup_at: string | null;
  total_cents: number;
  status: "pendiente" | "preparando" | "listo" | "entregado" | "cancelado";
  payment_method: "CASH" | "CARD" | "BIZUM" | null;
  payment_status: "pending" | "paid" | "failed" | null;
  items: OrderItem[];
};
// ------------------------------------------------------------------------

type Props = {
  initialOpenOrders: OrderWithItems[];
  initialCompletedOrders: OrderWithItems[];
};

type Range = "today" | "7" | "30" | "all";

function eur(cents: number) {
  return (cents / 100).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
}

function fmt(dt?: string | null) {
  if (!dt) return "-";
  const d = new Date(dt);
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function paymentBadge(
  method: "CASH" | "CARD" | "BIZUM" | null,
  status: "pending" | "paid" | "failed" | null
) {
  const meth = method === "CARD" ? "Tarjeta" : method === "BIZUM" ? "Bizum" : "Efectivo";

  if (status === "paid") {
    return (
      <span className="rounded bg-green-100 px-2 py-1 text-sm text-green-700">
        Pagado · {meth}
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="rounded bg-red-100 px-2 py-1 text-sm text-red-700">
        Fallido · {meth}
      </span>
    );
  }
  return (
    <span className="rounded bg-yellow-100 px-2 py-1 text-sm text-yellow-700">
      Pendiente · {meth}
    </span>
  );
}

const STATUS_OPTIONS = [
  { value: "pendiente", label: "pendiente" },
  { value: "preparando", label: "preparando" },
  { value: "listo", label: "listo" },
  { value: "entregado", label: "entregado" },
  { value: "cancelado", label: "cancelado" },
] as const;

export default function OrdersView({
  initialOpenOrders,
  initialCompletedOrders,
}: Props) {
  const router = useRouter();

  const [openOrders, setOpenOrders] =
    React.useState<OrderWithItems[]>(initialOpenOrders);
  const [completedOrders] =
    React.useState<OrderWithItems[]>(initialCompletedOrders);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [range, setRange] = React.useState<Range>("7");

  function toggle(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function updateStatus(id: string, newStatus: string) {
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!res.ok) {
        const t = await res.text();
        alert("No se pudo actualizar: " + t);
        return;
      }
      // Optimista en cliente
      setOpenOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status: newStatus as any } : o))
      );
      // Refrescamos para recolocar si pasa a completado
      router.refresh();
    } catch (e: any) {
      alert("Error al actualizar: " + (e?.message || "desconocido"));
    }
  }

  function filteredCompleted() {
    if (range === "all") return completedOrders;

    const now = new Date();
    let from: Date;

    if (range === "today") {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (range === "7") {
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return completedOrders.filter(
      (o) => new Date(o.created_at).getTime() >= from.getTime()
    );
  }

  return (
    <div className="space-y-10">
      {/* EN CURSO */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">En curso</h2>
          <button
            onClick={() => router.refresh()}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
          >
            Refrescar
          </button>
        </div>

        {openOrders.length === 0 ? (
          <p className="text-gray-500">No hay pedidos en curso.</p>
        ) : (
          <div className="overflow-x-auto rounded border">
            <table className="min-w-[900px] w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm">
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Teléfono</th>
                  <th className="p-3">Recogida</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Pago</th>
                  <th className="p-3">Detalles</th>
                </tr>
              </thead>
              <tbody>
                {openOrders.map((o) => {
                  const isOpen = !!expanded[o.id];
                  return (
                    <React.Fragment key={o.id}>
                      <tr className="border-b text-sm">
                        <td className="p-3">{fmt(o.created_at)}</td>
                        <td className="p-3">{o.customer_name || "-"}</td>
                        <td className="p-3">{o.customer_phone || "-"}</td>
                        <td className="p-3">{fmt(o.pickup_at)}</td>
                        <td className="p-3">{eur(o.total_cents)}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-800">
                              {o.status}
                            </span>
                            <select
                              className="rounded border p-1 text-sm"
                              value={o.status}
                              onChange={(e) => updateStatus(o.id, e.target.value)}
                            >
                              {STATUS_OPTIONS.map((op) => (
                                <option key={op.value} value={op.value}>
                                  {op.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="p-3">
                          {paymentBadge(o.payment_method, o.payment_status)}
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => toggle(o.id)}
                            className="text-blue-600 hover:underline"
                          >
                            {isOpen ? "Ocultar" : "Ver"}
                          </button>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr className="border-b bg-gray-50 text-sm">
                          <td className="p-3" colSpan={8}>
                            <div className="mb-2 font-medium">Artículos</div>

                            {o.items.length === 0 ? (
                              <div className="text-gray-500">Sin líneas.</div>
                            ) : (
                              <div className="space-y-1">
                                {o.items.map((it, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between"
                                  >
                                    <div>
                                      {it.name}{" "}
                                      <span className="text-gray-500">
                                        x{it.quantity}
                                      </span>
                                    </div>
                                    <div className="text-gray-600">
                                      {eur(it.line_total_cents)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="mt-3 flex justify-end font-semibold">
                              Total: {eur(o.total_cents)}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* COMPLETADOS */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Completados</h2>

          <div className="flex items-center gap-2">
            <FilterPill
              label="Hoy"
              active={range === "today"}
              onClick={() => setRange("today")}
            />
            <FilterPill
              label="Últimos 7 días"
              active={range === "7"}
              onClick={() => setRange("7")}
            />
            <FilterPill
              label="Últimos 30 días"
              active={range === "30"}
              onClick={() => setRange("30")}
            />
            <FilterPill
              label="Siempre"
              active={range === "all"}
              onClick={() => setRange("all")}
            />
          </div>
        </div>

        {filteredCompleted().length === 0 ? (
          <p className="text-gray-500">No hay pedidos en este periodo.</p>
        ) : (
          <div className="overflow-x-auto rounded border">
            <table className="min-w-[900px] w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm">
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Teléfono</th>
                  <th className="p-3">Recogida</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Pago</th>
                  <th className="p-3">Detalles</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompleted().map((o) => {
                  const isOpen = !!expanded[o.id];
                  return (
                    <React.Fragment key={o.id}>
                      <tr className="border-b text-sm">
                        <td className="p-3">{fmt(o.created_at)}</td>
                        <td className="p-3">{o.customer_name || "-"}</td>
                        <td className="p-3">{o.customer_phone || "-"}</td>
                        <td className="p-3">{fmt(o.pickup_at)}</td>
                        <td className="p-3">{eur(o.total_cents)}</td>
                        <td className="p-3">
                          <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-800">
                            {o.status}
                          </span>
                        </td>
                        <td className="p-3">
                          {paymentBadge(o.payment_method, o.payment_status)}
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => toggle(o.id)}
                            className="text-blue-600 hover:underline"
                          >
                            {isOpen ? "Ocultar" : "Ver"}
                          </button>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr className="border-b bg-gray-50 text-sm">
                          <td className="p-3" colSpan={8}>
                            <div className="mb-2 font-medium">Artículos</div>

                            {o.items.length === 0 ? (
                              <div className="text-gray-500">Sin líneas.</div>
                            ) : (
                              <div className="space-y-1">
                                {o.items.map((it, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between"
                                  >
                                    <div>
                                      {it.name}{" "}
                                      <span className="text-gray-500">
                                        x{it.quantity}
                                      </span>
                                    </div>
                                    <div className="text-gray-600">
                                      {eur(it.line_total_cents)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="mt-3 flex justify-end font-semibold">
                              Total: {eur(o.total_cents)}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm ${
        active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      {label}
    </button>
  );
}
