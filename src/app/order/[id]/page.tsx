// src/app/order/[id]/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type OrderItem = {
  quantity: number;
  name?: string | null;
  unit_price_cents: number;
};

type Order = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  pickup_at: string | null;
  status: "pendiente" | "preparando" | "listo" | "entregado" | "cancelado" | string;
  payment_method: "CASH" | "CARD" | "BIZUM";
  payment_status: "pending" | "paid" | "failed" | "refunded";
  total_cents: number;
  items: OrderItem[];
};

function centsToEUR(cents: number) {
  return (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

function paymentBadge(pm: Order["payment_method"], ps: Order["payment_status"]) {
  const method = pm === "CARD" ? "Tarjeta" : pm === "BIZUM" ? "Bizum" : "Efectivo";
  const text =
    ps === "paid" ? "Pagado" : ps === "failed" ? "Fallido" : ps === "refunded" ? "Reembolsado" : "Pendiente";
  const cls =
    ps === "paid"
      ? "bg-green-100 text-green-700"
      : ps === "failed"
      ? "bg-red-100 text-red-700"
      : ps === "refunded"
      ? "bg-purple-100 text-purple-700"
      : "bg-yellow-100 text-yellow-700";

  return <span className={`px-2 py-1 rounded text-sm ${cls}`}>{text} · {method}</span>;
}

// 👇 Aquí la clave: Next 15 tipa `params` como Promise en PageProps
type PageProps = {
  params: Promise<{ id: string }>;
};

export default function OrderDetailPage(props: PageProps) {
  const search = useSearchParams();
  const paidFlag = search.get("paid"); // ?paid=1 al volver de Stripe (opcional)

  const [id, setId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ensureJsPDF() {
    if ((window as any).jspdf?.jsPDF) return (window as any).jspdf.jsPDF;
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('No se pudo cargar jsPDF'));
      document.body.appendChild(s);
    });
    return (window as any).jspdf.jsPDF;
  }

  async function downloadPdf() {
    if (!order) return;
    try {
      const jsPDF = await ensureJsPDF();
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      let y = 50;
      doc.setFontSize(18);
      doc.text('Mi Restaurante', 300, y, { align: 'center' });
      y += 24;
      doc.setFontSize(12);
      doc.text(`Pedido #${order.id}`, 300, y, { align: 'center' });
      y += 20;

      const created = new Date(order.created_at).toLocaleString('es-ES');
      const pickup = order.pickup_at
        ? new Date(order.pickup_at).toLocaleString('es-ES')
        : '—';
      const method = order.payment_method === 'CARD' ? 'Tarjeta' : order.payment_method === 'BIZUM' ? 'Bizum' : 'Efectivo';
      const ps = order.payment_status === 'paid' ? 'Pagado' : order.payment_status === 'failed' ? 'Fallido' : order.payment_status === 'refunded' ? 'Reembolsado' : 'Pendiente';

      y += 10;
      doc.text(`Fecha: ${created}`, 60, y);
      y += 18;
      doc.text(`Cliente: ${order.customer_name}`, 60, y);
      y += 18;
      doc.text(`Teléfono: ${order.customer_phone}`, 60, y);
      y += 18;
      doc.text(`Recogida: ${pickup}`, 60, y);
      y += 18;
      doc.text(`Pago: ${method} — ${ps}`, 60, y);
      y += 24;

      doc.setFont(undefined, 'bold');
      doc.text('Artículos', 60, y);
      doc.setFont(undefined, 'normal');
      y += 14;
      doc.line(60, y, 535, y);
      y += 12;

      order.items.forEach((it) => {
        const subtotal = (it.unit_price_cents * it.quantity) / 100;
        doc.text(`${it.name ?? 'Producto'}`, 60, y);
        doc.text(`x${it.quantity}`, 400, y, { align: 'right' });
        doc.text(subtotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }), 535, y, { align: 'right' });
        y += 16;
        if (y > 760) { doc.addPage(); y = 60; }
      });

      y += 6;
      doc.line(60, y, 535, y);
      y += 18;
      doc.setFont(undefined, 'bold');
      doc.text('Total', 60, y);
      doc.text((order.total_cents/100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }), 535, y, { align: 'right' });
      doc.setFont(undefined, 'normal');

      const filename = `pedido-${String(order.id).slice(0,8)}.pdf`;
      doc.save(filename);
    } catch (e) {
      alert('No se pudo generar el PDF');
    }
  }

  // Resolvemos el Promise de params y guardamos el id
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
    loadOrder(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/" className="text-blue-600 underline">
          Volver al menú
        </Link>
        <div className="ml-auto">
          <button
            onClick={downloadPdf}
            className="px-3 py-2 rounded border hover:bg-gray-50"
          >
            Descargar PDF
          </button>
        </div>
      </div>

      <h1 className="text-2xl font-semibold mb-1">Detalle del pedido</h1>
      <div className="text-sm text-gray-600 mb-4">Código: {order.id}</div>

      {showPaidBanner ? (
        <div className="p-3 mb-6 rounded bg-green-100 text-green-700">
          ¡Pago completado correctamente! Estamos procesando tu pedido.
        </div>
      ) : order.payment_status === "pending" ? (
        <div className="p-3 mb-6 rounded bg-yellow-100 text-yellow-700">
          Tu pedido se ha creado. El pago aparece pendiente.
        </div>
      ) : order.payment_status === "failed" ? (
        <div className="p-3 mb-6 rounded bg-red-100 text-red-700">
          El pago ha fallado. Si el cargo no aparece en tu extracto, inténtalo de nuevo.
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section>
          <div className="font-medium mb-2">Cliente</div>
          <div className="border rounded p-3 space-y-1">
            <div><span className="text-gray-600">Nombre:</span> {order.customer_name}</div>
            <div><span className="text-gray-600">Teléfono:</span> {order.customer_phone}</div>
            <div><span className="text-gray-600">Fecha pedido:</span> {created}</div>
          </div>
        </section>

        <section>
          <div className="font-medium mb-2">Recogida</div>
          <div className="border rounded p-3 space-y-1">
            <div><span className="text-gray-600">Fecha y hora:</span> {pickup}</div>
            <div><span className="text-gray-600">Estado del pedido:</span> {order.status}</div>
            <div><span className="text-gray-600">Método y estado del pago:</span> {paymentBadge(order.payment_method, order.payment_status)}</div>
          </div>
        </section>
      </div>

      <section className="mt-8">
        <div className="font-medium mb-2">Artículos</div>
        <div className="border rounded p-3">
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
                    <td className="py-2 text-right">
                      {centsToEUR(it.quantity * it.unit_price_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="pt-3 font-semibold" colSpan={2}>
                    Total
                  </td>
                  <td className="pt-3 text-right font-semibold">
                    {centsToEUR(order.total_cents)}
                  </td>
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
