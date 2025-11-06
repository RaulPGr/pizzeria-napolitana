"use client";

import { useEffect, useState } from "react";

type AdminReservation = {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  party_size: number;
  reserved_at: string;
  notes: string | null;
  status: string;
  created_at: string;
};

function formatDate(value: string) {
  try {
    const d = new Date(value);
    return d.toLocaleString("es-ES", { dateStyle: "full", timeStyle: "short" });
  } catch {
    return value;
  }
}

export default function ReservationsClient() {
  const [items, setItems] = useState<AdminReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      const tenant = params.get("tenant")?.trim();
      const url = tenant ? `/api/admin/reservations?tenant=${encodeURIComponent(tenant)}` : "/api/admin/reservations";
      const resp = await fetch(url, { cache: "no-store" });
      const j = await resp.json();
      if (!resp.ok || !j?.ok) throw new Error(j?.error || "No se pudieron cargar las reservas");
      setItems(Array.isArray(j.reservations) ? j.reservations : []);
    } catch (e: any) {
      setError(e?.message || "No se pudieron cargar las reservas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Reservas</h2>
        <button
          onClick={() => load().catch(() => {})}
          className="rounded bg-slate-800 px-3 py-1 text-sm text-white hover:bg-slate-900"
          disabled={loading}
        >
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {error && (
        <div className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-4 py-2 text-left">Fecha</th>
              <th className="px-4 py-2 text-left">Cliente</th>
              <th className="px-4 py-2 text-left">Contacto</th>
              <th className="px-4 py-2 text-center">Comensales</th>
              <th className="px-4 py-2 text-left">Notas</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Aún no hay reservas registradas.
                </td>
              </tr>
            ) : null}
            {items.map((res) => (
              <tr key={res.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3">{formatDate(res.reserved_at)}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{res.customer_name}</div>
                </td>
                <td className="px-4 py-3">
                  <div>
                    <a className="text-blue-600 hover:underline" href={`tel:${res.customer_phone}`}>
                      {res.customer_phone}
                    </a>
                  </div>
                  {res.customer_email && (
                    <div>
                      <a className="text-blue-600 hover:underline" href={`mailto:${res.customer_email}`}>
                        {res.customer_email}
                      </a>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-center">{res.party_size}</td>
                <td className="px-4 py-3 text-slate-600">{res.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

