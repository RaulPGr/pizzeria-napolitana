"use client";

import React, { useEffect, useState } from "react";

type OrderItem = { quantity: number; name?: string | null; unit_price_cents: number };
type Order = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  pickup_at: string | null;
  status: string;
  payment_method: "CASH" | "CARD" | "BIZUM";
  payment_status: "pending" | "paid" | "failed" | "refunded";
  total_cents: number;
  items: OrderItem[];
};

type Biz = { name?: string | null; logo_url?: string | null };

function centsToEUR(cents: number) {
  return (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

// Versión optimizada para impresión/PDF del pedido.
export default function PrintTicketPage(props: any) {
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [biz, setBiz] = useState<Biz>({});
  const [error, setError] = useState<string | null>(null);

  // Resolver params (puede venir Promise)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const p = await Promise.resolve((props as any)?.params);
        if (mounted) setResolvedId(p?.id ?? null);
      } catch {
        if (mounted) setResolvedId(null);
      }
    })();
    return () => { mounted = false; };
  }, [props]);

  // Trae datos básicos del negocio para la cabecera del ticket.
  async function loadBiz() {
    try {
      const r = await fetch('/api/admin/business', { cache: 'no-store' });
      const j = await r.json().catch(() => ({} as any));
      if (j?.ok && j?.data) setBiz({ name: j.data.name, logo_url: j.data.logo_url });
    } catch {}
  }

  // Descarga el pedido y lanza window.print tras cargarlo.
  async function loadOrder(id: string) {
    try {
      setLoading(true); setError(null);
      const res = await fetch(`/api/orders/get?id=${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error("No se pudo cargar el pedido");
      const data = await res.json();
      setOrder(data?.order ?? null);
      setTimeout(() => window.print(), 300);
    } catch (e: any) {
      setError(e?.message ?? "Error"); setOrder(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadBiz(); }, []);
  useEffect(() => { if (resolvedId) void loadOrder(resolvedId); }, [resolvedId]);

  if (!resolvedId) return <div className="p-6">Cargando…</div>;
  if (loading) return <div className="p-6">Cargando…</div>;
  if (error || !order) return <div className="p-6">Error: {error ?? "desconocido"}</div>;

  const created = new Date(order.created_at).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const pickup = order.pickup_at ? new Date(order.pickup_at).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
  const method = order.payment_method === 'CARD' ? 'Tarjeta' : order.payment_method === 'BIZUM' ? 'Bizum' : 'Efectivo';
  const pstatus = order.payment_status === 'paid' ? 'Pagado' : order.payment_status === 'failed' ? 'Fallido' : order.payment_status === 'refunded' ? 'Reembolsado' : 'Pendiente';
  const code = `#${order.id.slice(0, 6)}`;

  return (
    <div className="sheet">
      <div className="card">
        <div className="header">
          {biz.logo_url ? <img src={biz.logo_url} alt="logo" className="logo" /> : null}
          <div className="title">{biz.name || 'Comidas para llevar'}</div>
          <div className="subtitle">Pedido {code}</div>
        </div>

        <div className="info">
          <div>Fecha: {created}</div>
          <div>Cliente: {order.customer_name}</div>
          <div>Teléfono: {order.customer_phone}</div>
          <div>Recogida: {pickup}</div>
          <div>Pago: {method} — {pstatus}</div>
        </div>

        <div className="section-title">Artículos</div>
        <table className="items">
          <thead>
            <tr>
              <th className="left">Producto</th>
              <th className="center">Ud.</th>
              <th className="right">Importe</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it, idx) => (
              <tr key={idx}>
                <td className="left">{it.name ?? 'Producto'}</td>
                <td className="center">x{it.quantity}</td>
                <td className="right">{centsToEUR(it.unit_price_cents * it.quantity)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td></td>
              <td className="right bold">Total</td>
              <td className="right bold">{centsToEUR(order.total_cents)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <style jsx global>{`
        :root { color-scheme: light; }
        body { background:#f3f4f6; }
        @media print { body { background:#fff; } .sheet { margin:0 !important; } }
        .sheet { max-width: 800px; margin: 24px auto; padding: 0 12px; }
        .card { background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:24px; box-shadow:0 1px 2px rgba(0,0,0,.06); }
        .header { display:flex; flex-direction:column; align-items:center; text-align:center; }
        .logo { width:96px; height:96px; object-fit:cover; border-radius:8px; border:1px solid #e5e7eb; margin-bottom:8px; }
        .title { font-size:22px; font-weight:600; color:#111827; }
        .subtitle { color:#6b7280; margin-top:2px; }
        .info { margin-top:24px; margin-bottom:16px; color:#111827; }
        .section-title { margin-top:12px; margin-bottom:6px; font-weight:600; }
        table.items { width:100%; border-collapse:collapse; }
        thead th { border-bottom:1px solid #e5e7eb; padding:8px 0; font-weight:600; color:#374151; }
        tbody td { padding:8px 0; border-bottom:1px solid #f3f4f6; }
        tfoot td { padding-top:12px; }
        .left { text-align:left; }
        .center { text-align:center; }
        .right { text-align:right; }
        .bold { font-weight:600; }
      `}</style>
    </div>
  );
}
