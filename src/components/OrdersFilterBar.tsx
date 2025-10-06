"use client";

export type Filters = {
  paymentMethod: "all" | "cash" | "card";             // "card" agrupa card/stripe
  paymentStatus: "all" | "paid" | "pending" | "failed";
};

type Props = {
  value: Filters;
  onChange: (v: Filters) => void;
  className?: string;
};

export default function OrdersFilterBar({ value, onChange, className = "" }: Props) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <label className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Método</span>
        <select
          value={value.paymentMethod}
          onChange={(e) =>
            onChange({ ...value, paymentMethod: e.target.value as Filters["paymentMethod"] })
          }
          className="border rounded-md px-2 py-1"
        >
          <option value="all">Todos</option>
          <option value="cash">Efectivo</option>
          <option value="card">Tarjeta</option>
        </select>
      </label>

      <label className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Estado pago</span>
        <select
          value={value.paymentStatus}
          onChange={(e) =>
            onChange({ ...value, paymentStatus: e.target.value as Filters["paymentStatus"] })
          }
          className="border rounded-md px-2 py-1"
        >
          <option value="all">Todos</option>
          <option value="paid">Pagado</option>
          <option value="pending">Pendiente</option>
          <option value="failed">Fallido</option>
        </select>
      </label>
    </div>
  );
}

// Utilidad de filtrado en cliente (no toca tu fetch)
export function applyOrderFilters<T extends {
  payment_method?: string | null;
  payment_status?: string | null;
}>(orders: T[], f: Filters) {
  return orders.filter((o) => {
    const method = (o.payment_method ?? "").toLowerCase();
    const status = (o.payment_status ?? "").toLowerCase();

    // "Tarjeta" = 'stripe' o 'card'
    const methodOk =
      f.paymentMethod === "all" ||
      (f.paymentMethod === "cash" && method === "cash") ||
      (f.paymentMethod === "card" && (method === "stripe" || method === "card"));

    const statusOk =
      f.paymentStatus === "all" || status === f.paymentStatus;

    return methodOk && statusOk;
  });
}
