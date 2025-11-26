// src/app/order/[id]/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type OrderItemOption = { name: string; groupName?: string | null; priceDelta?: number | null };
type OrderItem = { quantity: number; name?: string | null; unit_price_cents: number; options?: OrderItemOption[] };
type Order = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  pickup_at: string | null;
  status: string;
  payment_method?: "CASH" | "CARD" | "BIZUM";
  payment_status?: "pending" | "paid" | "failed" | "refunded";
  total_cents: number;
  items: OrderItem[];
};

type BizInfo = {
  name?: string | null;
  logo_url?: string | null;
};

function centsToEUR(cents: number) {
  return (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

type PageProps = { params: Promise<{ id: string }> };

// Página que muestra el pedido confirmado (la ve el cliente después de pagar).
export default function OrderDetailPage(props: PageProps) {
  const search = useSearchParams();
  const paidFlag = search.get("paid");

  const [id, setId] = useState("");
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [biz, setBiz] = useState<BizInfo>({});

  // Resolver id cuando Next lo entrega como Promise
  // params puede ser una Promise (Next 15); aquí resolvemos el id real.
  useEffect(() => {
    let alive = true;
    (async () => {
      const { id } = await props.params;
      if (alive) setId(String(id ?? ""));
    })();
    return () => {
      alive = false;
    };
  }, [props.params]);

  // Trae los datos del pedido desde la API interna.
  async function loadOrder(currentId: string) {
    if (!currentId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/orders/get?id=${currentId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("No se pudo cargar el pedido");
      const data = await res.json();
      setOrder(data?.order ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Error desconocido");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrder(id);
  }, [id]);

  // Datos del negocio (logo y nombre) para reproducir el aspecto del PDF.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/business", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data?.ok && data?.data) {
          setBiz({ name: data.data.name, logo_url: data.data.logo_url });
        }
      } catch {
        if (!cancelled) setBiz({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div className="p-6">Cargando…</div>;
  if (error || !order) return <div className="p-6">Error: {error ?? "No se pudo cargar el pedido"}</div>;

  const created = new Date(order.created_at).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const pickup = order.pickup_at
    ? new Date(order.pickup_at).toLocaleString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
  const showPaidBanner = paidFlag === "1" || order.payment_status === "paid";
  const methodLabel = order.payment_method === "CARD" ? "Tarjeta" : order.payment_method === "BIZUM" ? "Bizum" : "Efectivo";
  const paymentStatusLabel =
    order.payment_status === "paid"
      ? "Pagado"
      : order.payment_status === "failed"
      ? "Fallido"
      : order.payment_status === "refunded"
      ? "Reembolsado"
      : "Pendiente";
  const code = `#${String(order.id).split("-")[0].slice(0, 7)}`;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/menu"
          className="inline-flex items-center gap-2 rounded border bg-white px-3 py-2 text-blue-700 shadow-sm hover:bg-gray-50"
          aria-label="Volver al menú"
        >
          Volver al menú
        </Link>
        <div className="ml-auto">
          <button
            onClick={() => {
              const url = `/order/${id}/print`;
              const w = window.open(url, "_blank", "noopener,noreferrer");
              if (!w) window.location.href = url;
            }}
            className="inline-flex items-center gap-2 rounded border bg-white px-3 py-2 text-blue-700 shadow-sm hover:bg-gray-50"
            aria-label="Descargar PDF"
          >
            Descargar PDF
          </button>
        </div>
      </div>

      {showPaidBanner ? (
        <div className="p-3 mb-6 rounded bg-green-100 text-green-700">
          ¡Pago completado correctamente! Estamos procesando tu pedido.
        </div>
      ) : order.payment_status === "pending" ? (
        <div className="p-3 mb-6 rounded bg-yellow-100 text-yellow-700">Tu pedido se ha creado. El pago aparece pendiente.</div>
      ) : order.payment_status === "failed" ? (
        <div className="p-3 mb-6 rounded bg-red-100 text-red-700">
          El pago ha fallado. Si el cargo no aparece en tu extracto, inténtalo de nuevo.
        </div>
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
        {/* Cabecera con logo y nombre del comercio */}
        <div className="flex flex-col items-center text-center gap-3">
          {biz.logo_url ? (
            <img
              src={biz.logo_url}
              alt={biz.name ?? "Logo"}
              className="h-24 w-24 rounded-2xl border border-slate-200 object-cover"
            />
          ) : null}
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{biz.name || "Tu pedido"}</h1>
            <p className="text-slate-500">Pedido {code}</p>
          </div>
        </div>

        <div className="mt-6 space-y-2 text-sm text-slate-700">
          <div>
            <span className="font-semibold text-slate-900">Fecha:</span> {created}
          </div>
          <div>
            <span className="font-semibold text-slate-900">Cliente:</span> {order.customer_name}
          </div>
          <div>
            <span className="font-semibold text-slate-900">Teléfono:</span> {order.customer_phone}
          </div>
          <div>
            <span className="font-semibold text-slate-900">Recogida:</span> {pickup}
          </div>
          <div>
            <span className="font-semibold text-slate-900">Estado del pedido:</span> {order.status}
          </div>
          <div>
            <span className="font-semibold text-slate-900">Pago:</span> {methodLabel} — {paymentStatusLabel}
          </div>
        </div>

        {/* Tabla de artículos: incluye desglose de toppings para cada producto */}
        <div className="mt-8 border-t border-slate-100 pt-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Artículos</h2>
          {order.items?.length ? (
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-sm text-slate-500 border-b border-slate-200">
                  <th className="py-2 font-medium">Producto</th>
                  <th className="py-2 font-medium text-center">Ud.</th>
                  <th className="py-2 font-medium text-right">Importe</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((it, idx) => {
                  const optionTotalCents = (it.options || []).reduce(
                    (sum, opt) => sum + Math.round(((opt.priceDelta ?? 0) as number) * 100),
                    0
                  );
                  const basePriceCents = it.unit_price_cents - optionTotalCents;
                  return (
                    <tr key={idx} className="border-b border-slate-100 last:border-0 text-sm text-slate-800">
                      <td className="py-2">
                        <div className="font-medium">{it.name ?? "Producto"}</div>
                        <div className="text-xs text-slate-500">Precio base: {centsToEUR(basePriceCents)}</div>
                        {it.options && it.options.length > 0 ? (
                          <ul className="mt-1 text-xs text-slate-500 space-y-0.5">
                            {it.options.map((opt, optIdx) => {
                              const base = opt.groupName ? `${opt.groupName}: ${opt.name}` : opt.name;
                              const deltaCents = Math.round(((opt.priceDelta ?? 0) as number) * 100);
                              const deltaLabel =
                                deltaCents !== 0
                                  ? ` (${deltaCents > 0 ? "+" : "-"}${centsToEUR(Math.abs(deltaCents))})`
                                  : "";
                              return (
                                <li key={optIdx}>
                                  {base}
                                  {deltaLabel}
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </td>
                      <td className="py-2 text-center">x{it.quantity}</td>
                      <td className="py-2 text-right">{centsToEUR(it.quantity * it.unit_price_cents)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="text-sm text-slate-900">
                  <td></td>
                  <td className="py-3 text-right font-semibold">Total</td>
                  <td className="py-3 text-right font-semibold">{centsToEUR(order.total_cents)}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <div className="text-gray-600">No hay artículos asociados.</div>
          )}
        </div>
      </div>
    </div>
  );
}
