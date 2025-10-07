"use client";

import React, { useEffect, useState } from "react";

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
  status: string;
  payment_method: "CASH" | "CARD" | "BIZUM";
  payment_status: "pending" | "paid" | "failed" | "refunded";
  total_cents: number;
  items: OrderItem[];
};

function centsToEUR(cents: number) {
  return (cents / 100).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
  });
}

export default function PrintTicketPage(props: any) {
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Resolvemos params como Promise u objeto, lo que venga
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
    return () => {
      mounted = false;
    };
  }, [props]);

  async function loadOrder(id: string) {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/orders/get?id=${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error("No se pudo cargar el pedido");
      const data = await res.json();
      setOrder(data?.order ?? null);
      setTimeout(() => window.print(), 200);
    } catch (e: any) {
      setError(e?.message ?? "Error");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (resolvedId) loadOrder(resolvedId);
  }, [resolvedId]);

  if (!resolvedId) return <div className="p-6">Cargando…</div>;
  if (loading) return <div className="p-6">Cargando…</div>;
  if (error || !order) return <div className="p-6">Error: {error ?? "desconocido"}</div>;

  const dt = new Date(order.created_at).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
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

  const method =
    order.payment_method === "CARD"
      ? "Tarjeta"
      : order.payment_method === "BIZUM"
      ? "Bizum"
      : "Efectivo";

  return (
    <div className="ticket">
      <div className="center">
        <div className="title">Mi Restaurante</div>
        <div className="subtle">Pedido #{order.id.slice(0, 8).toUpperCase()}</div>
        <div className="subtle">Fecha: {dt}</div>
      </div>

      <div className="line" />

      <div className="row">
        <div>Cliente:</div>
        <div>{order.customer_name}</div>
      </div>
      <div className="row">
        <div>Teléfono:</div>
        <div>{order.customer_phone}</div>
      </div>
      <div className="row">
        <div>Recogida:</div>
        <div>{pickup}</div>
      </div>
      <div className="row">
        <div>Pago:</div>
        <div>
          {method} · {order.payment_status === "paid" ? "Pagado" : "Pendiente"}
        </div>
      </div>

      <div className="line" />

      <div className="bold mb-4">Artículos</div>
      <div className="items">
        {order.items.map((it, idx) => (
          <div className="item" key={idx}>
            <div className="item-left">
              x{it.quantity} {it.name ?? "Producto"}
            </div>
            <div className="item-right">
              {centsToEUR(it.unit_price_cents * it.quantity)}
            </div>
          </div>
        ))}
      </div>

      <div className="line" />
      <div className="row bold">
        <div>Total</div>
        <div>{centsToEUR(order.total_cents)}</div>
      </div>

      <div className="center mt-4 subtle">¡Gracias por su compra!</div>

      <style jsx global>{`
        @media print {
          @page {
            margin: 0;
          }
          body {
            margin: 0;
          }
        }
        .ticket {
          width: 80mm;
          max-width: 80mm;
          padding: 10px 12px;
          font-family: ui-monospace, Menlo, Monaco, Consolas, "Courier New",
            monospace;
          font-size: 12px;
          color: #111;
        }
        .center {
          text-align: center;
        }
        .title {
          font-size: 16px;
          font-weight: 700;
        }
        .subtle {
          color: #666;
        }
        .bold {
          font-weight: 700;
        }
        .mb-4 {
          margin-bottom: 8px;
        }
        .mt-4 {
          margin-top: 8px;
        }
        .line {
          border-top: 1px dashed #999;
          margin: 8px 0;
        }
        .row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin: 3px 0;
        }
        .items {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .item {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }
        .item-left {
          max-width: 60%;
          word-break: break-word;
        }
        .item-right {
          min-width: 70px;
          text-align: right;
        }
      `}</style>
    </div>
  );
}
