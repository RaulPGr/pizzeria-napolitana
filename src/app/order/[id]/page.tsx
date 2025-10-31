// src/app/order/[id]/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type OrderItem = { quantity: number; name?: string | null; unit_price_cents: number };
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

function centsToEUR(cents: number) {
  return (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

function paymentBadge(pm?: Order["payment_method"], ps?: Order["payment_status"]) {
  const method = pm === "CARD" ? "Tarjeta" : pm === "BIZUM" ? "Bizum" : "Efectivo";
  const text = ps === "paid" ? "Pagado" : ps === "failed" ? "Fallido" : ps === "refunded" ? "Reembolsado" : "Pendiente";
  const cls = ps === "paid" ? "bg-green-100 text-green-700" : ps === "failed" ? "bg-red-100 text-red-700" : ps === "refunded" ? "bg-purple-100 text-purple-700" : "bg-yellow-100 text-yellow-700";
  return <span className={`px-2 py-1 rounded text-sm ${cls}`}>{text} — {method}</span>;
}

type PageProps = { params: Promise<{ id: string }> };

export default function OrderDetailPage(props: PageProps) {
  const search = useSearchParams();
  const paidFlag = search.get("paid");

  const [id, setId] = useState("");
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Resolve id param (Next 15 Promise in params)
  useEffect(() => {
    let alive = true;
    (async () => {
      const { id } = await props.params;
      if (alive) setId(String(id ?? ""));
    })();
    return () => { alive = false; };
  }, [props.params]);

  async function loadOrder(currentId: string) {
    if (!currentId) return;
    try {
      setLoading(true); setError(null);
      const res = await fetch(`/api/orders/get?id=${currentId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("No se pudo cargar el pedido");
      const data = await res.json();
      setOrder(data?.order ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Error desconocido"); setOrder(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadOrder(id); }, [id]);

  if (loading) return <div className="p-6">Cargando…</div>;
  if (error || !order) return <div className="p-6">Error: {error ?? "No se pudo cargar el pedido"}</div>;

  const created = new Date(order.created_at).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const pickup = order.pickup_at ? new Date(order.pickup_at).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
  const showPaidBanner = paidFlag === "1" || order.payment_status === "paid";

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
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded border bg-white px-3 py-2 text-blue-700 shadow-sm hover:bg-gray-50"
            aria-label="Descargar PDF"
          >
            Descargar PDF
          </button>
        </div>
      </div>

      <h1 className="text-2xl font-semibold mb-1">Detalle del pedido</h1>
      <div className="mb-4">
        <span className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-sm shadow-sm">
          <span className="text-gray-600">Código</span>
          <span className="font-medium">#{String(order.id).split('-')[0].slice(0,7)}</span>
        </span>
      </div>

      {showPaidBanner ? (
        <div className="p-3 mb-6 rounded bg-green-100 text-green-700">¡Pago completado correctamente! Estamos procesando tu pedido.</div>
      ) : order.payment_status === "pending" ? (
        <div className="p-3 mb-6 rounded bg-yellow-100 text-yellow-700">Tu pedido se ha creado. El pago aparece pendiente.</div>
      ) : order.payment_status === "failed" ? (
        <div className="p-3 mb-6 rounded bg-red-100 text-red-700">El pago ha fallado. Si el cargo no aparece en tu extracto, inténtalo de nuevo.</div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section>
          <div className="font-medium mb-2">Cliente</div>
          <div className="rounded border bg-white p-3 shadow-sm space-y-1">
            <div><span className="text-gray-600">Nombre:</span> {order.customer_name}</div>
            <div><span className="text-gray-600">Teléfono:</span> {order.customer_phone}</div>
            <div><span className="text-gray-600">Fecha pedido:</span> {created}</div>
          </div>
        </section>

        <section>
          <div className="font-medium mb-2">Recogida</div>
          <div className="rounded border bg-white p-3 shadow-sm space-y-1">
            <div><span className="text-gray-600">Fecha y hora:</span> {pickup}</div>
            <div><span className="text-gray-600">Estado del pedido:</span> {order.status}</div>
            <div><span className="text-gray-600">Método y estado del pago:</span> {paymentBadge(order.payment_method, order.payment_status)}</div>
          </div>
        </section>
      </div>

      <section className="mt-8">
        <div className="font-medium mb-2">Artículos</div>
        <div className="rounded border bg-white p-3 shadow-sm">
          {order.items?.length ? (
            <table className="w-full">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Producto</th>
                  <th className="py-2">Cantidad</th>
                  <th className="py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((it, idx) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="py-2">{it.name ?? "Producto"}</td>
                    <td className="py-2">x{it.quantity}</td>
                    <td className="py-2 text-right">{centsToEUR(it.quantity * it.unit_price_cents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="pt-3 font-semibold" colSpan={2}>Total</td>
                  <td className="pt-3 text-right font-semibold">{centsToEUR(order.total_cents)}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <div className="text-gray-600">No hay artículos asociados.</div>
          )}
        </div>
      </section>
    </div>
  );
}
