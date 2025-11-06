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

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
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
  const [message, setMessage] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

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

  async function updateStatus(id: string, status: string) {
    setUpdating(id);
    setMessage(null);
    try {
      const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      const tenant = params.get("tenant")?.trim();
      const url = tenant ? `/api/admin/reservations?tenant=${encodeURIComponent(tenant)}` : "/api/admin/reservations";
      const resp = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const j = await resp.json();
      if (!resp.ok || !j?.ok) throw new Error(j?.error || "No se pudo actualizar");
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: j.reservation?.status ?? status } : item))
      );
      setMessage("Estado actualizado correctamente.");
    } catch (e: any) {
      setMessage(e?.message || "No se pudo actualizar el estado");
    } finally {
      setUpdating(null);
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
      {message && !error && (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>
      )}

      <div className="overflow-x-auto rounded border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-4 py-2 text-left">Fecha</th>
              <th className="px-4 py-2 text-left">Cliente</th>
              <th className="px-4 py-2 text-left">Contacto</th>
              <th className="px-4 py-2 text-center">Comensales</th>
              <th className="px-4 py-2 text-left">Estado</th>
              <th className="px-4 py-2 text-left">Notas</th>
              <th className="px-4 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
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
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[res.status] || "bg-slate-100 text-slate-700"
                      }`}
                  >
                    {STATUS_LABEL[res.status] || res.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{res.notes || "—"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="rounded border px-2 py-1 text-xs"
                      disabled={updating === res.id || res.status === "pending"}
                      onClick={() => updateStatus(res.id, "pending")}
                    >
                      Pendiente
                    </button>
                    <button
                      type="button"
                      className="rounded border border-emerald-500 px-2 py-1 text-xs text-emerald-700 disabled:opacity-50"
                      disabled={updating === res.id || res.status === "confirmed"}
                      onClick={() => updateStatus(res.id, "confirmed")}
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      className="rounded border border-rose-500 px-2 py-1 text-xs text-rose-600 disabled:opacity-50"
                      disabled={updating === res.id || res.status === "cancelled"}
                      onClick={() => updateStatus(res.id, "cancelled")}
                    >
                      Cancelar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
