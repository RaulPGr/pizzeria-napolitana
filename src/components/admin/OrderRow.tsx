// @ts-nocheck

// src/components/admin/OrderRow.tsx


"use client";

import { useState } from "react";
import OrderStatusClient from "@/components/admin/OrderStatusClient";

export type OrderItem = {
  name: string | null;
  quantity: number;
  unit_price_cents: number;
};

export type PaymentRow = {
  status: string | null;
};

export type OrderRowData = {
  id: string;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  pickup_at: string | null;
  total_cents: number;
  status: "pendiente" | "preparando" | "listo" | "entregado" | "cancelado";
  payment_method: string | null; // "CASH" | "CARD" | null
  payment_status: string | null; // "paid" | "pending" | "failed" | "succeeded" | ...
  order_items?: OrderItem[];
  payments?: PaymentRow[];
};

function formatMoney(cents: number) {
  return `${(cents / 100).toFixed(2)} €`;
}

function formatDate(dt: string | null) {
  if (!dt) return "—";
  const d = new Date(dt);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}, ${hh}:${min}`;
}

function StatusBadge({
  status,
}: {
  status: OrderRowData["status"];
}) {
  const styles: Record<NonNullable<OrderRowData["status"]>, string> = {
    pendiente: "bg-yellow-100 text-yellow-800",
    preparando: "bg-blue-100 text-blue-800",
    listo: "bg-indigo-100 text-indigo-800",
    entregado: "bg-green-100 text-green-800",
    cancelado: "bg-red-100 text-red-800",
  };
  return (
    <span className={`inline-block rounded px-2 py-1 text-sm ${styles[status]}`}>
      {status}
    </span>
  );
}

function PaymentBadge({
  method,
  status,
  payments,
}: {
  method: string | null;
  status: string | null;
  payments?: PaymentRow[];
}) {
  const m = (method ?? "").toUpperCase();
  const s = (status ?? "").toLowerCase();
  const ok = new Set(["paid", "succeeded", "completed", "captured"]);

  // CASH -> Efectivo
  if (m === "CASH") {
    return (
      <span className="inline-block rounded bg-gray-100 px-2 py-1 text-sm text-gray-800">
        Efectivo
      </span>
    );
  }

  // Si hay un payment OK en la tabla `payments`, lo consideramos pagado
  const hasSucceededPayment =
    (payments ?? []).some(p => ok.has((p.status ?? "").toLowerCase()));

  // CARD + (paid/succeeded/completed/captured) || payment OK → Pagado
  if (m === "CARD" && (ok.has(s) || hasSucceededPayment)) {
    return (
      <span className="inline-block rounded bg-green-100 px-2 py-1 text-sm text-green-800">
        Pagado
      </span>
    );
  }

  // Resto → Pendiente
  return (
    <span className="inline-block rounded bg-yellow-100 px-2 py-1 text-sm text-yellow-800">
      Pendiente
    </span>
  );
}

export default function OrderRow({ row }: { row: OrderRowData }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr className="align-top">
        <td className="px-3 py-2 text-sm text-gray-800">{formatDate(row.created_at)}</td>
        <td className="px-3 py-2 text-sm text-gray-800">{row.customer_name || "—"}</td>
        <td className="px-3 py-2 text-sm text-gray-800">{row.customer_phone || "—"}</td>
        <td className="px-3 py-2 text-sm text-gray-800">{formatDate(row.pickup_at)}</td>
        <td className="px-3 py-2 text-sm text-gray-800">{formatMoney(row.total_cents)}</td>

        {/* Estado + selector (cliente) */}
        <td className="px-3 py-2 text-sm">
          <div className="flex items-center gap-2">
            <StatusBadge status={row.status} />
            <OrderStatusClient orderId={row.id} status={row.status} />
          </div>
        </td>

        {/* Pago */}
        <td className="px-3 py-2 text-sm">
          <PaymentBadge
            method={row.payment_method}
            status={row.payment_status}
            payments={row.payments}
          />
        </td>

        {/* Detalles – toggle inline */}
        <td className="px-3 py-2 text-sm">
          <button
            onClick={() => setOpen(v => !v)}
            className="text-blue-600 hover:underline"
            type="button"
          >
            {open ? "Ocultar" : "Ver"}
          </button>
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={8} className="bg-gray-50 px-4 py-3">
            <div className="text-sm text-gray-800">
              <div className="font-medium mb-1">Artículos</div>
              {(row.order_items ?? []).length === 0 ? (
                <div className="text-gray-500">Sin artículos.</div>
              ) : (
                <ul className="space-y-1">
                  {(row.order_items ?? []).map((it, idx) => (
                    <li key={idx} className="flex items-center justify-between">
                      <div>
                        {it.name ?? "—"} <span className="text-gray-500">x{it.quantity}</span>
                      </div>
                      <div className="tabular-nums">
                        {formatMoney(it.unit_price_cents * it.quantity)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2 text-right font-semibold">
                Total: {formatMoney(row.total_cents)}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
