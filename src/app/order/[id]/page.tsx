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
  return <span className={`px-2 py-1 rounded text-sm ${cls}`}>{text} · {method}</span>;
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

  function buildPrintHtml(o: Order) {
    const createdAt = new Date(o.created_at).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const pickupAt = o.pickup_at ? new Date(o.pickup_at).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
    const rows = (o.items || []).map((it) => `
      <tr>
        <td>${(it.name ?? 'Producto').replace(/</g, '&lt;')}</td>
        <td style="text-align:center">x${it.quantity}</td>
        <td style="text-align:right">${(it.quantity * it.unit_price_cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
      </tr>
    `).join("");
    const code = `#${String(o.id).split('-')[0].slice(0,7)}`;
    const payMethod = o.payment_method === 'CARD' ? 'Tarjeta' : o.payment_method === 'BIZUM' ? 'Bizum' : 'Efectivo';
    const payStatus = o.payment_status === 'paid' ? 'Pagado' : o.payment_status === 'failed' ? 'Fallido' : o.payment_status === 'refunded' ? 'Reembolsado' : 'Pendiente';
    return `<!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Pedido ${code}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin: 24px; color: #111827; }
          h1 { font-size: 20px; margin: 0 0 8px; }
          .chip { display:inline-flex; align-items:center; gap:8px; padding:4px 10px; border:1px solid #e5e7eb; border-radius:9999px; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,.05); font-size:12px; color:#374151 }
          .grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:12px }
          .card { border:1px solid #e5e7eb; border-radius:8px; background:#fff; padding:12px; box-shadow:0 1px 2px rgba(0,0,0,.04) }
          .muted { color:#6b7280 }
          table { width:100%; border-collapse:collapse; }
          th, td { padding:8px 0; }
          thead th { text-align:left; border-bottom:1px solid #e5e7eb; }
          tbody tr + tr { border-top:1px solid #f3f4f6; }
          tfoot td { padding-top:12px; font-weight:600 }
          .right { text-align:right }
          .center { text-align:center }
          @media print { .no-print { display:none } }
        </style>
      </head>
      <body>
        <div style="display:flex; gap:12px; align-items:center; margin-bottom:16px">
          <h1>Detalle del pedido</h1>
          <span class="chip"><span class="muted">Código</span> <strong>${code}</strong></span>
          <span class="chip"><span class="muted">${payMethod}</span> ${payStatus}</span>
        </div>

        <div class="grid">
          <div>
            <div style="font-weight:600; margin-bottom:6px">Cliente</div>
            <div class="card">
              <div><span class="muted">Nombre:</span> ${o.customer_name ?? ''}</div>
              <div><span class="muted">Teléfono:</span> ${o.customer_phone ?? ''}</div>
              <div><span class="muted">Fecha pedido:</span> ${createdAt}</div>
            </div>
          </div>
          <div>
            <div style="font-weight:600; margin-bottom:6px">Recogida</div>
            <div class="card">
              <div><span class="muted">Fecha y hora:</span> ${pickupAt}</div>
              <div><span class="muted">Estado del pedido:</span> ${o.status}</div>
              <div><span class="muted">Método y estado del pago:</span> ${payMethod} · ${payStatus}</div>
            </div>
          </div>
        </div>

        <div style="margin-top:20px">
          <div style="font-weight:600; margin-bottom:6px">Artículos</div>
          <div class="card">
            <table>
              <thead>
                <tr><th>Producto</th><th class="center">Cantidad</th><th class="right">Subtotal</th></tr>
              </thead>
              <tbody>${rows}</tbody>
              <tfoot>
                <tr><td colspan="2">Total</td><td class="right">${(o.total_cents/100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td></tr>
              </tfoot>
            </table>
          </div>
        </div>
        <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 30); };</script>
      </body>
      </html>`;
  }

  function downloadPdf() {
    try {
      const html = buildPrintHtml(order!);
      const w = window.open("", "_blank", "noopener,noreferrer");
      if (!w) { window.print(); return; }
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch {
      try { window.print(); } catch {}
    }
  }

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
            onClick={downloadPdf}
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

