// src/app/admin/orders/page.tsx
"use client";
import { useEffect, useState } from "react";

type Order = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  pickup_at: string | null;
  status: "pending"|"confirmed"|"preparing"|"ready"|"delivered"|"cancelled";
  total_cents: number;
  created_at: string;
  payment_method: "cash"|"card" | null;
  payment_status: "unpaid"|"paid"|"refunded";
};

const STATUSES: Order["status"][] = ["pending","confirmed","preparing","ready","delivered","cancelled"];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/orders", { cache: "no-store" });
    const json = await res.json();
    if (!json.ok) {
      setError(json.message ?? "Error cargando pedidos");
      setOrders([]);
    } else {
      setOrders(json.orders);
    }
    setLoading(false);
  }

  async function updateStatus(id: string, status: Order["status"]) {
    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!json.ok) return alert(json.message ?? "Error al actualizar");
    await load();
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="p-6">Cargando pedidos…</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Pedidos</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {orders.map(o => (
          <div key={o.id} className="rounded-2xl border p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="font-medium">#{o.id.slice(0,8)}</div>
              <span className="text-sm opacity-70">{new Date(o.created_at).toLocaleString()}</span>
            </div>

            <div className="mt-2 text-sm">
              <div><span className="opacity-60">Cliente:</span> {o.customer_name ?? "—"}</div>
              <div><span className="opacity-60">Teléfono:</span> {o.customer_phone ?? "—"}</div>
              <div><span className="opacity-60">Recogida:</span> {o.pickup_at ? new Date(o.pickup_at).toLocaleString() : "—"}</div>
              <div><span className="opacity-60">Pago:</span> {o.payment_method ?? "cash"} · {o.payment_status}</div>
              <div className="font-semibold mt-1">Total: {(o.total_cents/100).toFixed(2)} €</div>
            </div>

            <div className="mt-3">
              <label className="text-sm opacity-60">Estado</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => updateStatus(o.id, s)}
                    className={`px-3 py-1 rounded-full text-sm border ${o.status === s ? "bg-black text-white" : "hover:bg-gray-100"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
        {orders.length === 0 && <div className="opacity-70">No hay pedidos todavía.</div>}
      </div>
    </div>
  );
}
