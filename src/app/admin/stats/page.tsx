"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Order = {
  id: string;
  status: string | null;
  total_cents: number | null;
  created_at: string;
};

type RangeKey = "today" | "7d" | "30d" | "month" | "all";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "7d", label: "Últimos 7 días" },
  { key: "30d", label: "Últimos 30 días" },
  { key: "month", label: "Este mes" },
  { key: "all", label: "Siempre" },
];

function startEndForRange(key: RangeKey) {
  const now = new Date();
  const end = new Date(now);
  let start: Date | null = null;

  if (key === "today") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  } else if (key === "7d") {
    const s = new Date(now);
    s.setDate(s.getDate() - 6);
    start = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0);
  } else if (key === "30d") {
    const s = new Date(now);
    s.setDate(s.getDate() - 29);
    start = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0);
  } else if (key === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
  } else if (key === "all") {
    start = null; // sin filtro
  }

  return { start, end };
}

function formatEur(cents: number) {
  return `${(cents / 100).toFixed(2)} €`;
}

export default function AdminStatsPage() {
  const [range, setRange] = useState<RangeKey>("7d");
  const [{ start, end }, setDates] = useState(() => startEndForRange("7d"));
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setDates(startEndForRange(range));
  }, [range]);

  async function fetchOrders() {
    setLoading(true);
    try {
      let q = supabase
        .from("orders")
        .select("id,status,total_cents,created_at")
        .order("created_at", { ascending: true });

      if (start) q = q.gte("created_at", start.toISOString());
      if (end) q = q.lte("created_at", end.toISOString());

      const { data, error } = await q;
      if (error) throw error;

      setOrders((data ?? []) as Order[]);
    } catch (e) {
      console.error("stats fetchOrders error:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrders();
    // Suscripción realtime: refresca cuando hay inserts/updates
    const channel = supabase
      .channel("admin-stats-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => fetchOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start?.toISOString(), end?.toISOString()]);

  // KPIs
  const kpis = useMemo(() => {
    const totalOrders = orders.length;
    const delivered = orders.filter((o) => o.status === "entregado").length;
    const cancelled = orders.filter((o) => o.status === "cancelado").length;
    const revenueCents = orders
      .filter((o) => o.status === "entregado" && o.total_cents)
      .reduce((acc, o) => acc + (o.total_cents || 0), 0);
    const aovCents =
      delivered > 0
        ? Math.round(
            revenueCents / delivered
          )
        : 0;

    return {
      totalOrders,
      delivered,
      cancelled,
      revenueCents,
      aovCents,
    };
  }, [orders]);

  // Serie diaria (barras) – sumatorio del día (solo entregados)
  const daily = useMemo(() => {
    if (!start) {
      // si es "Siempre", construimos desde la primera fecha disponible
      if (orders.length === 0) return [];
      const first = new Date(orders[0].created_at);
      const s = new Date(first.getFullYear(), first.getMonth(), first.getDate(), 0, 0, 0);
      const e = new Date();
      return buildDailySeries(orders, s, e);
    }
    return buildDailySeries(orders, start, end || new Date());
  }, [orders, start, end]);

  // Donut por estados: entregado / en_proceso / cancelado
  const donut = useMemo(() => {
    const delivered = orders.filter((o) => o.status === "entregado").length;
    const processing = orders.filter((o) =>
      ["pendiente", "preparando", "listo"].includes(o.status || "")
    ).length;
    const cancelled = orders.filter((o) => o.status === "cancelado").length;
    const total = delivered + processing + cancelled || 1;

    return {
      delivered,
      processing,
      cancelled,
      pDelivered: (delivered / total) * 100,
      pProcessing: (processing / total) * 100,
      pCancelled: (cancelled / total) * 100,
    };
  }, [orders]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Estadísticas</h1>
        <div className="flex items-center gap-2">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-3 py-1 rounded border text-sm ${
                r.key === range
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Pedidos (total)" value={kpis.totalOrders.toString()} />
        <KpiCard
          title="Entregados"
          value={kpis.delivered.toString()}
          tone="success"
        />
        <KpiCard
          title="Cancelados"
          value={kpis.cancelled.toString()}
          tone="danger"
        />
        <KpiCard
          title="Ingresos"
          value={formatEur(kpis.revenueCents)}
          subtitle={`Ticket medio: ${formatEur(kpis.aovCents)}`}
          tone="primary"
        />
      </section>

      {/* Gráficos */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Barras por día */}
        <div className="col-span-2 p-4 border rounded bg-white">
          <h3 className="font-semibold mb-3">Ingresos por día</h3>
          {loading ? (
            <div className="h-32 animate-pulse bg-gray-100 rounded" />
          ) : daily.length === 0 ? (
            <p className="text-gray-500">Sin datos en este rango.</p>
          ) : (
            <BarMiniChart data={daily} />
          )}
        </div>

        {/* Donut por estado */}
        <div className="p-4 border rounded bg-white">
          <h3 className="font-semibold mb-3">Distribución por estado</h3>
          {loading ? (
            <div className="h-40 animate-pulse bg-gray-100 rounded" />
          ) : (
            <DonutState
              delivered={donut.delivered}
              processing={donut.processing}
              cancelled={donut.cancelled}
              pDelivered={donut.pDelivered}
              pProcessing={donut.pProcessing}
              pCancelled={donut.pCancelled}
            />
          )}
        </div>
      </section>
    </div>
  );
}

/* ----------------- helpers & componentes ----------------- */

function buildDailySeries(orders: Order[], s: Date, e: Date) {
  // inicializa días del rango
  const days: { key: string; date: Date; cents: number }[] = [];
  const cur = new Date(s);
  cur.setHours(0, 0, 0, 0);

  const end = new Date(e);
  end.setHours(0, 0, 0, 0);

  while (cur <= end) {
    const key = cur.toISOString().slice(0, 10);
    days.push({ key, date: new Date(cur), cents: 0 });
    cur.setDate(cur.getDate() + 1);
  }

  // agrega ingresos por día (solo entregados)
  for (const o of orders) {
    if (o.status !== "entregado" || !o.total_cents) continue;
    const key = new Date(o.created_at).toISOString().slice(0, 10);
    const d = days.find((d) => d.key === key);
    if (d) d.cents += o.total_cents || 0;
  }

  return days;
}

function KpiCard({
  title,
  value,
  subtitle,
  tone = "default",
}: {
  title: string;
  value: string;
  subtitle?: string;
  tone?: "default" | "primary" | "success" | "danger";
}) {
  const tones: Record<
    NonNullable<typeof tone>,
    { bg: string; text: string; border: string }
  > = {
    default: { bg: "bg-white", text: "text-gray-900", border: "border-gray-200" },
    primary: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    success: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
    danger: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  };

  const t = tones[tone];

  return (
    <div className={`p-4 rounded border ${t.bg} ${t.border}`}>
      <p className="text-sm text-gray-500">{title}</p>
      <p className={`text-2xl font-semibold ${t.text}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

function BarMiniChart({
  data,
}: {
  data: { key: string; date: Date; cents: number }[];
}) {
  const max = Math.max(...data.map((d) => d.cents), 1);
  return (
    <div>
      <div className="h-40 flex items-end gap-1">
        {data.map((d) => {
          const h = Math.round((d.cents / max) * 100);
          return (
            <div key={d.key} className="flex-1 flex flex-col items-center">
              <div
                className="w-full bg-blue-500 rounded-t"
                style={{ height: `${h}%` }}
                title={`${d.key} — ${formatEur(d.cents)}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 text-[10px] text-gray-500">
        {data
          .filter((_, i) => i % Math.ceil(data.length / 7 || 1) === 0)
          .map((d) => (
            <div key={d.key}>{d.key.slice(5)}</div>
          ))}
      </div>
    </div>
  );
}

function DonutState({
  delivered,
  processing,
  cancelled,
  pDelivered,
  pProcessing,
  pCancelled,
}: {
  delivered: number;
  processing: number;
  cancelled: number;
  pDelivered: number;
  pProcessing: number;
  pCancelled: number;
}) {
  const grad = `conic-gradient(
    #10b981 ${pDelivered}%,
    #60a5fa 0 ${pDelivered + pProcessing}%,
    #fca5a5 0 ${Math.min(100, pDelivered + pProcessing + pCancelled)}%
  )`;

  return (
    <div className="flex items-center gap-6">
      <div
        className="w-32 h-32 rounded-full"
        style={{
          background: grad,
          boxShadow: "inset 0 0 0 18px white",
        }}
        aria-label="Distribución por estado"
      />
      <div className="space-y-2 text-sm">
        <Legend color="#10b981" label="Entregados" value={delivered} />
        <Legend color="#60a5fa" label="En proceso" value={processing} />
        <Legend color="#fca5a5" label="Cancelados" value={cancelled} />
      </div>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block w-3 h-3 rounded"
        style={{ backgroundColor: color }}
      />
      <span className="text-gray-700">{label}</span>
      <span className="text-gray-500">· {value}</span>
    </div>
  );
}
