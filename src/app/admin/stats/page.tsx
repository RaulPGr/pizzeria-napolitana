"use client";

// Estadísticas del panel admin
// Implementación ligera (sin librerías externas) con gráficos básicos usando CSS

import { useEffect, useMemo, useState } from "react";
import { useAdminAccess } from "@/context/AdminAccessContext";

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
  if (key === "today") start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  else if (key === "7d") { const s = new Date(now); s.setDate(s.getDate() - 6); start = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0); }
  else if (key === "30d") { const s = new Date(now); s.setDate(s.getDate() - 29); start = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0); }
  else if (key === "month") start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
  else if (key === "all") start = null;
  return { start, end };
}

function formatEur(cents: number) { try { return (cents/100).toLocaleString('es-ES',{style:'currency',currency:'EUR'});} catch { return `${(cents/100).toFixed(2)} €`; } }

type Dataset = {
  ordersCount: number;
  deliveredCount: number;
  cancelledCount: number;
  revenueCents: number;
  aovCents: number;
  topProducts: Array<{ key: string; name: string; qty: number; cents: number }>;
  worstProducts: Array<{ key: string; name: string; qty: number; cents: number }>;
  byWeekday: Array<{ weekday: number; cents: number; count: number }>;
  byHour: Array<{ hour: number; cents: number; count: number }>;
  customers: Array<{ key: string; name: string; count: number; cents: number; avgCents: number }>;
  newVsReturning: { newCount: number; returningCount: number };
  monthly: Array<{ ym: string; cents: number; count: number }>;
  byCategory: Array<{ id: number | 'nocat'; name: string; cents: number; qty: number }>;
};

export default function AdminStatsPage() {
  const { plan, isSuper } = useAdminAccess();
  const limited = plan === "starter" && !isSuper;
  if (limited) {
    return (
      <div className="rounded border border-amber-200 bg-amber-50 p-4 text-amber-800 shadow-sm">
        Tu suscripción Starter/Medium no incluye estadísticas. Actualiza a Premium para ver estos reportes.
      </div>
    );
  }

  const [range, setRange] = useState<RangeKey>('7d');
  const [{ start, end }, setDates] = useState(() => startEndForRange('7d'));
  const [data, setData] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setDates(startEndForRange(range)); }, [range]);

  async function fetchData() {
    setLoading(true);
    try {
      const url = new URL('/api/admin/stats', window.location.origin);
      if (start) url.searchParams.set('from', start.toISOString());
      if (end) url.searchParams.set('to', end.toISOString());
      // Fallback: si la cookie del tenant no está disponible en esta petición,
      // añadimos el slug del subdominio como parámetro (?tenant=...). No rompe nada.
      const host = window.location.hostname;
      const parts = host.split('.');
      if (parts.length >= 3) {
        url.searchParams.set('tenant', parts[0].toLowerCase());
      }
      const r = await fetch(url.toString(), { cache: 'no-store' });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.message || 'Error');
      setData(j.data as Dataset);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  useEffect(() => { void fetchData(); }, [start?.toISOString(), end?.toISOString()]);

  const kpis = useMemo(() => ({
    totalOrders: data?.ordersCount || 0,
    delivered: data?.deliveredCount || 0,
    cancelled: data?.cancelledCount || 0,
    revenueCents: data?.revenueCents || 0,
    aovCents: data?.aovCents || 0,
  }), [data]);

  const donut = useMemo(() => {
    const d = kpis.delivered, c = kpis.cancelled, p = Math.max(0, (kpis.totalOrders - d - c));
    const total = kpis.totalOrders || 1; return {
      delivered: d, processing: p, cancelled: c,
      pDelivered: (d/total)*100, pProcessing:(p/total)*100, pCancelled:(c/total)*100
    };
  }, [kpis]);

  return (
    <div className="space-y-6">
      {/* Header y rango */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Estadísticas</h2>
        <div className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <button key={r.key} onClick={() => setRange(r.key)} className={`rounded border px-3 py-1 text-sm ${r.key===range? 'bg-blue-600 text-white border-blue-600':'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>{r.label}</button>
          ))}
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Pedidos (total)" value={kpis.totalOrders.toString()} />
        <KpiCard title="Entregados" value={kpis.delivered.toString()} tone="success" />
        <KpiCard title="Cancelados" value={kpis.cancelled.toString()} tone="danger" />
        <KpiCard title="Ingresos" value={formatEur(kpis.revenueCents)} subtitle={`Ticket medio: ${formatEur(kpis.aovCents)}`} tone="primary" />
      </section>

      {/* Estado y serie diaria */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="p-4 border rounded bg-white lg:col-span-2">
          <h3 className="font-semibold mb-3">Ingresos por mes</h3>
          {loading ? <Skeleton /> : <BarMiniChart data={(data?.monthly||[]).map(m=>({ key:m.ym, date:new Date(m.ym+"-01"), cents:m.cents }))} />}
        </div>
        <div className="p-4 border rounded bg-white">
          <h3 className="font-semibold mb-3">Distribución por estado</h3>
          {loading ? <div className="h-40 animate-pulse bg-gray-100 rounded" /> : <DonutState delivered={donut.delivered} processing={donut.processing} cancelled={donut.cancelled} pDelivered={donut.pDelivered} pProcessing={donut.pProcessing} pCancelled={donut.pCancelled} />}
        </div>
      </section>

      {/* Productos */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Top 5 productos más vendidos">{loading ? <Skeleton /> : <BarH data={(data?.topProducts||[]).map(p=>({label:p.name, value:p.qty}))} suffix=" uds" />}</Card>
        <Card title="Productos menos vendidos">{loading ? <Skeleton /> : <BarH data={(data?.worstProducts||[]).map(p=>({label:p.name, value:p.qty}))} suffix=" uds" />}</Card>
      </section>

      {/* Día y hora */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Ventas por día de la semana">{loading ? <Skeleton /> : <BarH data={(data?.byWeekday||[]).map(w=>({label:['D','L','M','X','J','V','S'][w.weekday], value:w.cents/100}))} prefix="€ " />}</Card>
        <Card title="Horas con más pedidos">{loading ? <Skeleton /> : <BarH data={(data?.byHour||[]).map(h=>({label:String(h.hour).padStart(2,'0'), value:h.count}))} suffix=" pedidos" />}</Card>
      </section>

      {/* Clientes */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2" title="Clientes más frecuentes">
          {loading ? <Skeleton /> : <TableSimple rows={(data?.customers||[]).map(c=>({left:`${c.name}`, right:`${c.count} pedidos · ${formatEur(c.cents)} · ticket ${formatEur(c.avgCents)}`}))} />}
        </Card>
        <Card title="Nuevos vs recurrentes">
          {loading ? <Skeleton /> : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Nuevos</span><span>{data?.newVsReturning.newCount ?? 0}</span></div>
              <div className="flex justify-between"><span>Recurrentes</span><span>{data?.newVsReturning.returningCount ?? 0}</span></div>
            </div>
          )}
        </Card>
      </section>

      {/* Categorías */}
      <Card title="Ingresos por categoría">{loading ? <Skeleton /> : <BarH data={(data?.byCategory||[]).map(c=>({label:c.name, value:c.cents/100}))} prefix="€ " />}</Card>
    </div>
  );
}

/* ---------- UI helpers ---------- */
function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`p-4 border rounded bg-white ${className}`}>
      <h3 className="font-semibold mb-3">{title}</h3>
      {children}
    </section>
  );
}

function Skeleton() { return <div className="h-40 animate-pulse bg-gray-100 rounded" />; }

function KpiCard({ title, value, subtitle, tone = "default" }: { title: string; value: string; subtitle?: string; tone?: "default" | "primary" | "success" | "danger" }) {
  const tones: Record<NonNullable<typeof tone>, { bg: string; text: string; border: string }> = {
    default: { bg: "bg-white", text: "text-gray-900", border: "border-brand-crust" },
    primary: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    success: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
    danger: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  };
  const t = tones[tone];
  return <div className={`p-4 rounded border ${t.bg} ${t.border}`}><p className="text-sm text-gray-500">{title}</p><p className={`text-2xl font-semibold ${t.text}`}>{value}</p>{subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}</div>;
}

function BarMiniChart({ data }: { data: { key: string; date: Date; cents: number }[] }) {
  const max = Math.max(...data.map((d) => d.cents), 1);
  return (
    <div>
      <div className="h-40 flex items-end gap-1">
        {data.map((d) => { const h = Math.round((d.cents / max) * 100); return (<div key={d.key} className="flex-1 flex flex-col items-center"><div className="w-full bg-blue-500 rounded-t" style={{ height: `${h}%` }} title={`${d.key} · ${formatEur(d.cents)}`} /></div>); })}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 text-[10px] text-gray-500">
        {data.filter((_, i) => i % Math.ceil(data.length / 7 || 1) === 0).map((d) => (<div key={d.key}>{d.key.slice(5)}</div>))}
      </div>
    </div>
  );
}

function DonutState({ delivered, processing, cancelled, pDelivered, pProcessing, pCancelled }: { delivered: number; processing: number; cancelled: number; pDelivered: number; pProcessing: number; pCancelled: number }) {
  const grad = `conic-gradient(#10b981 ${pDelivered}%, #60a5fa 0 ${pDelivered + pProcessing}%, #fca5a5 0 ${Math.min(100, pDelivered + pProcessing + pCancelled)}%)`;
  return (
    <div className="flex items-center gap-6">
      <div className="w-32 h-32 rounded-full" style={{ background: grad, boxShadow: 'inset 0 0 0 18px white' }} aria-label="Distribución por estado" />
      <div className="space-y-2 text-sm">
        <Legend color="#10b981" label="Entregados" value={delivered} />
        <Legend color="#60a5fa" label="En proceso" value={processing} />
        <Legend color="#fca5a5" label="Cancelados" value={cancelled} />
      </div>
    </div>
  );
}
function Legend({ color, label, value }: { color: string; label: string; value: number }) { return (<div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: color }} /> <span className="text-gray-700">{label}</span> <span className="text-gray-500">· {value}</span></div>); }

function BarH({ data, prefix = "", suffix = "" }: { data: { label: string; value: number }[]; prefix?: string; suffix?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2">
          <div className="w-40 truncate text-sm text-gray-700" title={d.label}>{d.label}</div>
          <div className="flex-1 h-3 bg-gray-100 rounded">
            <div className="h-3 bg-emerald-600 rounded" style={{ width: `${Math.round((d.value / max) * 100)}%` }} />
          </div>
          <div className="w-24 text-right text-sm text-gray-700" title={`${prefix}${d.value}${suffix}`}>{prefix}{typeof d.value==='number' ? (Math.round(d.value*100)/100).toLocaleString('es-ES') : d.value}{suffix}</div>
        </div>
      ))}
    </div>
  );
}

// Lista simple de dos columnas para rankings
function TableSimple({ rows }: { rows: { left: string; right: string }[] }) {
  if (!rows || rows.length === 0) {
    return <div className="text-sm text-gray-500">Sin datos para el rango seleccionado.</div>;
  }
  return (
    <div className="divide-y rounded border">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between p-2 text-sm">
          <span className="text-gray-700 truncate pr-2">{r.left}</span>
          <span className="font-medium text-gray-900">{r.right}</span>
        </div>
      ))}
    </div>
  );
}
