// src/app/admin/orders/OrdersClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "delivered" | "cancelled";

type OrderRow = {
  id: string;
  code: string | null;
  customer_name: string;
  customer_phone: string | null;
  notes?: string | null;
  pickup_at: string | null;
  status: OrderStatus;
  total_cents: number;
  payment_method: string | null;
  payment_status: string | null;
  created_at: string;
};

type OrderItem = {
  id: string;
  product_id: number | null;
  name: string;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
};

type OrderDetailResponse = {
  ok: boolean;
  data?: { order: OrderRow; items: OrderItem[] };
  message?: string;
};

type ListResponse = { ok: boolean; data?: OrderRow[]; message?: string };

const estadoEtiqueta: Record<OrderStatus, string> = {
  pending: "pendiente",
  confirmed: "confirmado",
  preparing: "preparando",
  ready: "listo",
  delivered: "entregado",
  cancelled: "cancelado",
};

const pagarEtiqueta: Record<string, string> = { cash: "efectivo", card: "tarjeta", stripe: "tarjeta" };

function eur(cents: number) {
  return (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

export default function OrdersClient() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [activeSort, setActiveSort] = useState<"pickup" | "created">("pickup");

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [openDetailId, setOpenDetailId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, OrderItem[]>>({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({});
  const [highlights, setHighlights] = useState<Record<string, boolean>>({});
  const [initialized, setInitialized] = useState(false);
  const seenIdsRef = (globalThis as any).__pl_seen_orders || new Set<string>();
  ;(globalThis as any).__pl_seen_orders = seenIdsRef;

  useEffect(() => {
    void reload();
  }, []);

  // Realtime + polling de respaldo
  useEffect(() => {
    let t: number | undefined;
    const schedule = () => {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(() => void reload(), 200);
    };
    const channel = supabase
      .channel("orders-admin")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload: any) => {
        try { window.dispatchEvent(new CustomEvent('pl:new-order')); } catch {}
        // Marca visual inmediata por ID si viene en el payload
        try {
          const newId = payload?.new?.id as string | undefined;
          if (newId) setHighlights((prev) => ({ ...prev, [newId]: true }));
        } catch {}
        schedule();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, schedule)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "orders" }, schedule)
      .subscribe();
    const iv = window.setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, 15000);
    return () => {
      if (t) window.clearTimeout(t);
      window.clearInterval(iv);
      supabase.removeChannel(channel);
    };
  }, []);

  async function reload() {
    setLoading(true);
    try {
      const url = new URL("/api/orders/list", window.location.origin);
      if (query.trim()) url.searchParams.set("q", query.trim());
      if (statusFilter !== "all") url.searchParams.set("status", statusFilter);
      const r = await fetch(url.toString(), { cache: "no-store" });
      const json: ListResponse = await r.json();
      if (json.ok && json.data) {
        // Detectar pedidos nuevos por ID (fallback si Realtime falla)
        const incoming = json.data;
        if (!initialized) {
          incoming.forEach(o => seenIdsRef.add(o.id));
          setInitialized(true);
        } else {
          const newOnes = incoming.filter(o => !seenIdsRef.has(o.id));
          if (newOnes.length > 0) {
            try { window.dispatchEvent(new CustomEvent('pl:new-order')); } catch {}
            // Marcar los nuevos para resaltar visualmente
            setHighlights((prev) => {
              const next = { ...prev } as Record<string, boolean>;
              newOnes.forEach((o) => { next[o.id] = true; });
              return next;
            });
            newOnes.forEach(o => seenIdsRef.add(o.id));
            // Mantener el set razonable
            if (seenIdsRef.size > 2000) {
              // Reinicializa con los IDs actuales
              const fresh = new Set(incoming.map(o => o.id));
              (globalThis as any).__pl_seen_orders = fresh;
            }
          }
        }
        setOrders(incoming);
      }
      else setOrders([]);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  const { activos, historico } = useMemo(() => {
    const a: OrderRow[] = [];
    const h: OrderRow[] = [];
    for (const o of orders) {
      (o.status === "delivered" || o.status === "cancelled") ? h.push(o) : a.push(o);
    }
    const toMs = (iso: string | null) => (iso ? new Date(iso).getTime() : Number.POSITIVE_INFINITY);
    if (activeSort === "pickup") {
      a.sort((x, y) => {
        const ax = toMs(x.pickup_at) !== Infinity ? toMs(x.pickup_at) : (new Date(x.created_at).getTime() + 9e12);
        const ay = toMs(y.pickup_at) !== Infinity ? toMs(y.pickup_at) : (new Date(y.created_at).getTime() + 9e12);
        return ax - ay;
      });
    } else {
      a.sort((x, y) => y.created_at.localeCompare(x.created_at));
    }
    h.sort((x, y) => y.created_at.localeCompare(x.created_at));
    return { activos: a, historico: h };
  }, [orders, activeSort]);

  async function changeStatus(order: OrderRow, next: OrderStatus) {
    if (order.status === next) return;
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: next } : o)));
    try {
      const r = await fetch(`/api/orders/${order.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await r.json();
      if (!r.ok || !json?.ok) throw new Error(json?.message || "No se pudo actualizar el estado");
    } catch {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: order.status } : o)));
      alert("No se pudo actualizar el estado del pedido");
    }
  }

  async function toggleDetail(order: OrderRow) {
    const id = order.id;
    setOpenDetailId(id === openDetailId ? null : id);
    // Quitar resaltado al revisar el pedido (abrir detalle)
    setHighlights((prev) => (prev[id] ? { ...prev, [id]: false } : prev));
    if (id === openDetailId || detailCache[id]) return;
    setDetailLoading((s) => ({ ...s, [id]: true }));
    try {
      const r = await fetch(`/api/orders/${id}`);
      const json: OrderDetailResponse = await r.json();
      if (!json.ok || !json.data) throw new Error(json.message || "No se pudo cargar el detalle");
      setDetailCache((c) => ({ ...c, [id]: json.data!.items }));
    } catch {
      alert("No se pudo cargar el detalle del pedido");
    } finally {
      setDetailLoading((s) => ({ ...s, [id]: false }));
    }
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="mb-2 text-sm text-gray-600">
          {loading ? "Cargando pedidos..." : `Mostrando ${orders.length} pedido${orders.length === 1 ? "" : "s"}`}
        </div>
        <div className="grid items-center gap-3 sm:grid-cols-[1fr,180px,200px,auto,auto]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o teléfono…"
            className="h-10 rounded-md border px-3"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-10 rounded-md border px-3"
          >
            <option value="all">Todos</option>
            <option value="pending">Pendiente</option>
            <option value="confirmed">Confirmado</option>
            <option value="preparing">Preparando</option>
            <option value="ready">Listo</option>
            <option value="delivered">Entregado</option>
            <option value="cancelled">Cancelado</option>
          </select>
          <select
            value={activeSort}
            onChange={(e) => setActiveSort(e.target.value as any)}
            className="h-10 rounded-md border px-3"
          >
            <option value="pickup">Por hora de recogida</option>
            <option value="created">Por fecha de creación</option>
          </select>
          <button
            onClick={() => {
              setQuery("");
              setStatusFilter("all");
              void reload();
            }}
            className="h-10 rounded-md border px-4"
          >
            Limpiar
          </button>
          <button onClick={() => void reload()} className="h-10 rounded-md bg-black px-4 text-white">
            Actualizar
          </button>
        </div>
      </div>

      {/* Activos */}
      {activos.map((o) => (
        <div
          key={o.id}
          className={[
            'rounded-lg border shadow-sm transition-colors',
            highlights[o.id] ? 'bg-blue-50 ring-2 ring-blue-300' : 'bg-white'
          ].join(' ')}
        >
          <div className="flex items-center justify-between border-b px-4 py-3 text-sm text-gray-600">
            <div className="font-medium">
              #{(o.code ?? o.id).slice(0, 7)}
              {highlights[o.id] && (
                <span className="ml-2 inline-flex items-center rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-semibold text-white shadow">NUEVO</span>
              )}
              {!highlights[o.id] && openDetailId === o.id && (
                <span className="ml-2 inline-flex items-center rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white shadow">VISTO</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {o.pickup_at && (
                <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium text-emerald-700 border-emerald-200 bg-emerald-50">
                  Recogida {new Date(o.pickup_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <span className="opacity-70">{new Date(o.created_at).toLocaleString("es-ES")}</span>
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="space-y-1 text-sm">
              <div>
                <span className="text-gray-500">Cliente:</span> {o.customer_name}
              </div>
              <div>
                <span className="text-gray-500">Teléfono:</span> {o.customer_phone || "—"}
              </div>
              <div>
                <span className="text-gray-500">Pago:</span> {pagarEtiqueta[o.payment_method || "cash"] || o.payment_method || "—"} · {o.payment_status === "paid" ? "pagado" : "no pagado"}
              </div>
              <div className="font-semibold">Total: {eur(o.total_cents)}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["pending", "confirmed", "preparing", "ready", "delivered", "cancelled"] as OrderStatus[]).map((s) => {
                const active = o.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => void changeStatus(o, s)}
                    className={`rounded-full border px-3 py-1 text-sm ${active ? "bg-black text-white" : "bg-gray-100"}`}
                  >
                    {estadoEtiqueta[s]}
                  </button>
                );
              })}
            </div>
            <div className="mt-3">
              <button onClick={() => void toggleDetail(o)} className="text-sm font-medium underline underline-offset-2">
                {openDetailId === o.id ? "Ocultar detalle" : "Ver detalle"}
              </button>
              {openDetailId === o.id && (
                <div className="mt-3 overflow-hidden rounded-md border">
                  {o.notes && (
                    <div className="px-3 py-2 text-sm bg-rose-50 text-rose-800 border-b border-rose-200">
                      <span className="mr-2 inline-block rounded bg-rose-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">NOTA</span>
                      {o.notes}
                    </div>
                  )}
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2">Cant.</th>
                        <th className="px-3 py-2">Producto</th>
                        <th className="px-3 py-2">P. unitario</th>
                        <th className="px-3 py-2">Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailLoading[o.id] && (
                        <tr>
                          <td colSpan={4} className="px-3 py-3 text-center text-gray-500">
                            Cargando detalle…
                          </td>
                        </tr>
                      )}
                      {!detailLoading[o.id] && (detailCache[o.id] || []).map((it) => (
                        <tr key={it.id} className="border-t">
                          <td className="px-3 py-2">{it.quantity}</td>
                          <td className="px-3 py-2">{it.name}</td>
                          <td className="px-3 py-2">{eur(it.unit_price_cents)}</td>
                          <td className="px-3 py-2">{eur(it.line_total_cents)}</td>
                        </tr>
                      ))}
                      {!detailLoading[o.id] && detailCache[o.id] && (
                        <tr className="border-t bg-gray-50 font-medium">
                          <td className="px-3 py-2" colSpan={3}>
                            Total
                          </td>
                          <td className="px-3 py-2">{eur(o.total_cents)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Histórico */}
      <details className="rounded-lg border bg-white shadow-sm" open={false}>
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
          Histórico (entregados y cancelados) · {historico.length || "0"}
        </summary>

        {historico.length === 0 ? (
          <div className="px-4 pb-4 text-sm text-gray-600">No hay pedidos entregados o cancelados.</div>
        ) : (
          <div className="px-4 pb-4">
            {historico.map((o) => (
              <div key={o.id} className="mb-3 overflow-hidden rounded-md border">
                <div className="flex items-center justify-between bg-gray-50 px-3 py-2 text-sm">
                  <div className="font-medium">#{(o.code ?? o.id).slice(0, 7)} · {estadoEtiqueta[o.status]}</div>
                  <div>{new Date(o.created_at).toLocaleString("es-ES")}</div>
                </div>
                <div className="px-3 py-2 text-sm text-gray-700">
                  <div>
                    <span className="text-gray-500">Cliente:</span> {o.customer_name}
                  </div>
                  <div>
                    <span className="text-gray-500">Teléfono:</span> {o.customer_phone || "—"}
                  </div>
                  <div className="font-medium">Total: {eur(o.total_cents)}</div>
                  <div className="mt-2">
                    <button onClick={() => void toggleDetail(o)} className="text-xs font-medium underline underline-offset-2">
                      {openDetailId === o.id ? "Ocultar detalle" : "Ver detalle"}
                    </button>
                    {openDetailId === o.id && (
                      <div className="mt-2 overflow-hidden rounded-md border">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2">Cant.</th>
                              <th className="px-3 py-2">Producto</th>
                              <th className="px-3 py-2">P. unitario</th>
                              <th className="px-3 py-2">Importe</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailLoading[o.id] && (
                              <tr>
                                <td colSpan={4} className="px-3 py-3 text-center text-gray-500">
                                  Cargando detalle…
                                </td>
                              </tr>
                            )}
                            {!detailLoading[o.id] && (detailCache[o.id] || []).map((it) => (
                              <tr key={it.id} className="border-t">
                                <td className="px-3 py-2">{it.quantity}</td>
                                <td className="px-3 py-2">{it.name}</td>
                                <td className="px-3 py-2">{eur(it.unit_price_cents)}</td>
                                <td className="px-3 py-2">{eur(it.line_total_cents)}</td>
                              </tr>
                            ))}
                            {!detailLoading[o.id] && detailCache[o.id] && (
                              <tr className="border-t bg-gray-50 font-medium">
                                <td className="px-3 py-2" colSpan={3}>
                                  Total
                                </td>
                                <td className="px-3 py-2">{eur(o.total_cents)}</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </details>
    </div>
  );
}
