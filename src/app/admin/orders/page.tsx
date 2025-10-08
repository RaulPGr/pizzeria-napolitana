"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import OrdersFilterBar, { applyOrderFilters, Filters } from "@/components/OrdersFilterBar";

// fuerza Node.js (no Edge) y evita prerender
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;


/* ============================
   Tipos mínimos de la API
   ============================ */
type OrderItem = {
  name: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
};

type Order = {
  id: string;
  code?: string | null;

  created_at: string;  // ISO
  pickup_at: string;   // ISO

  customer_name: string;
  customer_phone: string;

  total_cents: number;
  status: "pendiente" | "preparando" | "listo" | "entregado" | "cancelado";

  payment_method: "cash" | "CASH" | "card" | "CARD" | "stripe" | null;
  payment_status: "pending" | "paid" | "failed" | null;

  items?: OrderItem[];
};

/* ============================
   Utilidades de formateo
   ============================ */

function eurFromCents(cents: number) {
  return (cents / 100).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
}

function formatCreatedAt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Corrige desfase a Europe/Madrid
function formatPickupHourMadrid(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPaymentBadge(
  method: Order["payment_method"],
  status: Order["payment_status"]
) {
  if (!status) return { text: "—", color: "bg-gray-100 text-gray-700" };

  const m = (method ?? "").toString().toLowerCase();
  const methodTxt =
    m === "card" || m === "stripe"
      ? "Tarjeta"
      : m === "cash"
      ? "Efectivo"
      : "—";

  const map: Record<NonNullable<Order["payment_status"]>, { text: string; color: string }> = {
    paid: { text: "Pagado", color: "bg-green-100 text-green-800" },
    pending: { text: "Pendiente", color: "bg-yellow-100 text-yellow-800" },
    failed: { text: "Fallido", color: "bg-red-100 text-red-800" },
  };

  const st = map[status] ?? { text: status, color: "bg-gray-100 text-gray-800" };

  return methodTxt === "—"
    ? { text: st.text, color: st.color }
    : { text: `${st.text} · ${methodTxt}`, color: st.color };
}

/* ============================
   Pitido sin archivos (Web Audio)
   ============================ */
function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc.start(now);
    osc.stop(now + 0.6);
  } catch {}
}

/* ============================
   Página
   ============================ */

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [range, setRange] = useState<"today" | "7d" | "30d" | "all">("7d");
  const [query, setQuery] = useState("");
  const [openRow, setOpenRow] = useState<Record<string, boolean>>({});

  const [notifEnabled, setNotifEnabled] = useState(false);

  // ⬇️ NUEVO: filtros
  const [filters, setFilters] = useState<Filters>({
    paymentMethod: "all",
    paymentStatus: "all",
  });

  // ids previos para detectar nuevos pedidos (beep)
  const prevIdsRef = useRef<Set<string>>(new Set());

  async function loadOrders(selectedRange = range, silent = false) {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ range: selectedRange });
      const res = await fetch(`/api/orders?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Request failed");
      }
      const data = await res.json();
      const list: Order[] = Array.isArray(data.orders) ? data.orders : [];

      // detectar nuevos (beep + notificación)
      const newIds = new Set(list.map((o) => o.id));
      const prev = prevIdsRef.current;
      const hasNew = [...newIds].some((id) => !prev.has(id));
      prevIdsRef.current = newIds;

      setOrders(list);

      if (hasNew) {
        playBeep();
        if (notifEnabled && Notification.permission === "granted") {
          const newest = list[0];
          const body = newest
            ? `Cliente: ${newest.customer_name} · Total: ${eurFromCents(newest.total_cents)}`
            : "Nuevo pedido";
          new Notification("Nuevo pedido", { body });
        }
      }
    } catch (e: any) {
      console.error(e);
      setError("No se pudieron cargar los pedidos.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  // Carga inicial y cuando cambia el rango
  useEffect(() => {
    loadOrders(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  // Auto refresco cada 20s (silent)
  useEffect(() => {
    const t = setInterval(() => loadOrders(range, true), 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  // ⬇️ Aplico filtros + buscador y separo en curso / completados
  const [inProgress, completed] = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filteredByPay = applyOrderFilters(orders, filters);

    const filteredByQuery = filteredByPay.filter((o) => {
      if (!q) return true;
      const haystack =
        `${o.code ?? ""} ${o.customer_name} ${o.customer_phone} ` +
        `${(o.items || []).map((i) => i.name).join(" ")}`.toLowerCase();
      return haystack.includes(q);
    });

    const current = filteredByQuery.filter(
      (o) => o.status !== "entregado" && o.status !== "cancelado"
    );
    const done = filteredByQuery.filter(
      (o) => o.status === "entregado" || o.status === "cancelado"
    );

    return [current, done];
  }, [orders, query, filters]);

  // Notificaciones
  const askNotifications = async () => {
    try {
      if (!("Notification" in window)) return;
      const perm = await Notification.requestPermission();
      setNotifEnabled(perm === "granted");
    } catch {
      setNotifEnabled(false);
    }
  };

  // ==== NUEVO: actualizar estado (PATCH a /api/orders/[id]/status) ====
  const handleStatusChange = async (orderId: string, newStatus: Order["status"]) => {
    // guardo estado anterior por si hay que revertir
    const prev = orders;
    // optimista: actualizo UI
    setOrders((cur) => cur.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || "No se pudo actualizar el estado");
      }
      // nada más: la UI ya está actualizada y el split en curso/completados se recalcula solo
    } catch (err: any) {
      // revertir
      setOrders(prev);
      alert(err?.message || "No se pudo actualizar el estado");
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Pedidos</h1>

        {/* Buscador */}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por cliente, teléfono, código o producto…"
          className="ml-4 min-w-[260px] flex-1 rounded border px-3 py-2 text-sm"
        />

        {/* Rango */}
        <div className="flex items-center gap-2">
          <RangeButton active={range === "today"} onClick={() => setRange("today")}>
            Hoy
          </RangeButton>
          <RangeButton active={range === "7d"} onClick={() => setRange("7d")}>
            Últimos 7 días
          </RangeButton>
          <RangeButton active={range === "30d"} onClick={() => setRange("30d")}>
            Últimos 30 días
          </RangeButton>
          <RangeButton active={range === "all"} onClick={() => setRange("all")}>
            Siempre
          </RangeButton>
        </div>

        <div className="flex-1" />

        {/* Notificaciones */}
        <button
          onClick={askNotifications}
          className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
        >
          {notifEnabled ? "Notificaciones activas" : "Activar notificaciones"}
        </button>

        {/* Refrescar */}
        <button
          className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
          onClick={() => loadOrders(range)}
          disabled={loading}
        >
          {loading ? "Cargando…" : "Refrescar"}
        </button>
      </div>

      {/* ⬇️ NUEVO: barra de filtros */}
      <OrdersFilterBar value={filters} onChange={setFilters} className="mb-4" />

      {/* Error */}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {/* EN CURSO */}
      <SectionTitle>En curso</SectionTitle>
      <OrdersTable
        orders={inProgress}
        openRow={openRow}
        setOpenRow={setOpenRow}
        allowStatusChange
        onStatusChange={handleStatusChange}
      />

      {/* COMPLETADOS */}
      <SectionTitle className="mt-10">Completados</SectionTitle>
      <OrdersTable
        orders={completed}
        openRow={openRow}
        setOpenRow={setOpenRow}
        allowStatusChange={false}
        onStatusChange={handleStatusChange}
      />

      {!loading && !error && orders.length === 0 && (
        <div className="mt-8 rounded border border-dashed p-6 text-center text-sm text-gray-500">
          No hay pedidos para el rango seleccionado.
        </div>
      )}
    </div>
  );
}

/* ============================
   Componentes auxiliares
   ============================ */

function SectionTitle({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <h2 className={`mb-3 text-lg font-medium ${className}`}>{children}</h2>;
}

function RangeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-3 py-1.5 text-sm ${
        active ? "bg-blue-600 text-white" : "border text-gray-700 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

function OrdersTable({
  orders,
  openRow,
  setOpenRow,
  allowStatusChange,
  onStatusChange,
}: {
  orders: Order[];
  openRow: Record<string, boolean>;
  setOpenRow: (next: Record<string, boolean>) => void;
  allowStatusChange: boolean;
  onStatusChange: (id: string, status: Order["status"]) => void;
}) {
  if (orders.length === 0) {
    return (
      <div className="rounded border border-dashed p-4 text-sm text-gray-500">
        No hay pedidos.
      </div>
    );
  }

  // opciones visibles (las que pediste). Si el estado actual no está en la lista,
  // lo mostramos como opción deshabilitada para no romper nada.
  const allowed: Order["status"][] = ["pendiente", "listo", "entregado", "cancelado"];

  return (
    <div className="overflow-x-auto rounded border">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <Th>Fecha</Th>
            <Th>Cliente</Th>
            <Th>Teléfono</Th>
            <Th>Recogida</Th>
            <Th>Total</Th>
            <Th>Estado</Th>
            <Th>Pago</Th>
            <Th>Detalles</Th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {orders.map((o) => {
            const pay = formatPaymentBadge(o.payment_method, o.payment_status);
            const detailOpen = !!openRow[o.id];
            const showDisabledCurrent =
              !allowed.includes(o.status) ? [{ value: o.status, disabled: true }] : [];

            return (
              <>
                <tr key={o.id}>
                  <Td className="whitespace-nowrap">{formatCreatedAt(o.created_at)}</Td>
                  <Td className="whitespace-nowrap">{o.customer_name}</Td>
                  <Td className="whitespace-nowrap">{o.customer_phone}</Td>
                  <Td className="whitespace-nowrap">{formatPickupHourMadrid(o.pickup_at)}</Td>
                  <Td className="whitespace-nowrap">{eurFromCents(o.total_cents)}</Td>

                  <Td className="whitespace-nowrap">
                    <span className="rounded bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                      {o.status}
                    </span>
                    {allowStatusChange && (
                      <select
                        className="ml-2 rounded border px-2 py-1 text-xs"
                        value={o.status}
                        onChange={(e) => onStatusChange(o.id, e.target.value as Order["status"])}
                      >
                        {showDisabledCurrent.map((opt) => (
                          <option key="__current" value={opt.value} disabled>
                            {opt.value}
                          </option>
                        ))}
                        {allowed.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    )}
                  </Td>

                  <Td className="whitespace-nowrap">
                    <span className={`rounded px-2 py-1 text-xs font-medium ${pay.color}`}>
                      {pay.text}
                    </span>
                  </Td>

                  <Td className="whitespace-nowrap">
                    <button
                      className="text-blue-600 underline"
                      onClick={() => setOpenRow({ ...openRow, [o.id]: !detailOpen })}
                    >
                      {detailOpen ? "Ocultar" : "Ver"}
                    </button>
                  </Td>
                </tr>

                {detailOpen && (
                  <tr>
                    <td colSpan={8} className="bg-gray-50 p-0">
                      <div className="px-6 py-4">
                        <div className="mb-2 text-sm font-medium text-gray-700">Artículos</div>
                        <div className="rounded border">
                          <table className="min-w-full text-xs">
                            <thead className="bg-gray-100 text-gray-600">
                              <tr>
                                <Th className="text-left">Nombre</Th>
                                <Th className="text-right">Cantidad</Th>
                                <Th className="text-right">Precio</Th>
                                <Th className="text-right">Total</Th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {(o.items || []).map((it, idx) => (
                                <tr key={o.id + "-it-" + idx}>
                                  <Td className="text-left">{it.name}</Td>
                                  <Td className="text-right">{it.quantity}</Td>
                                  <Td className="text-right">
                                    {eurFromCents(it.unit_price_cents)}
                                  </Td>
                                  <Td className="text-right">
                                    {eurFromCents(it.line_total_cents)}
                                  </Td>
                                </tr>
                              ))}
                              {(!o.items || o.items.length === 0) && (
                                <tr>
                                  <Td colSpan={4} className="text-center text-gray-500">
                                    Sin líneas de pedido.
                                  </Td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-3 text-right text-sm">
                          <span className="font-medium">Total: </span>
                          {eurFromCents(o.total_cents)}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <th className={`px-4 py-2 text-left ${className}`}>{children}</th>;
}
function Td({
  children,
  className = "",
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td className={`px-4 py-2 align-top ${className}`} colSpan={colSpan}>
      {children}
    </td>
  );
}
