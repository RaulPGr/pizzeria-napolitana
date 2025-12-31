"use client";

import { useEffect, useMemo, useState } from "react";
import { persistTenantSlugClient, resolveTenantSlugClient } from "@/lib/tenant-client";

type OpeningHours = Record<string, Array<{ abre?: string; cierra?: string; open?: string; close?: string }>>;

type Config = {
  enabled: boolean;
  businessName: string;
  businessAddress: string | null;
  businessLogo: string | null;
  hours: OpeningHours | null;
  slots: Array<{ from: string; to: string; capacity?: number }> | null;
  blockedDates: string[];
  leadHours: number | null;
  maxDays: number | null;
};

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAY_KEYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"] as const;

function parseTramos(list: any): Array<{ start: number; end: number }> {
  if (!Array.isArray(list)) return [];
  const out: Array<{ start: number; end: number }> = [];
  for (const tramo of list) {
    const open = (tramo?.abre ?? tramo?.open ?? "").split(":");
    const close = (tramo?.cierra ?? tramo?.close ?? "").split(":");
    if (open.length === 2 && close.length === 2) {
      const start = Number(open[0]) * 60 + Number(open[1]);
      const end = Number(close[0]) * 60 + Number(close[1]);
      if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
        out.push({ start, end });
      }
    }
  }
  return out;
}

function buildSlots(tramos: Array<{ start: number; end: number }>, minDate?: Date) {
  const slots: string[] = [];
  const step = 30; // minutes
  const minMinutes = minDate ? minDate.getHours() * 60 + minDate.getMinutes() : null;
  for (const tramo of tramos) {
    for (let minutes = tramo.start; minutes < tramo.end; minutes += step) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const slot = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
      if (minMinutes !== null && minutes < minMinutes) continue;
      slots.push(slot);
    }
  }
  return slots;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function hhmmToMinutes(v: string) {
  const [h, m] = v.split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function buildSlotsFromCustom(
  rawSlots: Array<{ from: string; to: string }>,
  selectedDate: string,
  leadHours: number | null
) {
  const slots: string[] = [];
  const step = 30;
  const today = new Date();
  const selDate = new Date(selectedDate + "T00:00:00");
  const enforceLead = leadHours && leadHours > 0 && selDate && sameDay(today, selDate);
  const minLeadMinutes = enforceLead ? today.getHours() * 60 + today.getMinutes() + leadHours * 60 : null;
  for (const s of rawSlots) {
    if (!/^\d{2}:\d{2}$/.test(s.from) || !/^\d{2}:\d{2}$/.test(s.to)) continue;
    const start = hhmmToMinutes(s.from);
    const end = hhmmToMinutes(s.to);
    if (end <= start) continue;
    for (let minutes = start; minutes < end; minutes += step) {
      if (minLeadMinutes !== null && minutes < minLeadMinutes) continue;
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      slots.push(`${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`);
    }
  }
  return slots;
}

export default function ReservationsClient() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [people, setPeople] = useState(2);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [uiHint, setUiHint] = useState<string | null>(null);
  const [datesWithStatus, setDatesWithStatus] = useState<Array<{ date: string; blocked: boolean }>>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const tenant = resolveTenantSlugClient();
        if (tenant) persistTenantSlugClient(tenant);
        const url = tenant ? `/api/settings/home?tenant=${encodeURIComponent(tenant)}` : "/api/settings/home";
        const resp = await fetch(url, { cache: "no-store" });
        const j = await resp.json();
        if (!active) return;
        if (!resp.ok || !j?.data) {
          setError(j?.error || "No se pudo cargar la configuración");
          return;
        }
        const cfg = j.data;
        setConfig({
          enabled: !!cfg.reservations?.enabled,
          businessName: cfg.business?.name || "Nuestro restaurante",
          businessAddress: cfg.contact?.address || null,
          businessLogo: cfg.images?.logo || null,
          hours: cfg.hours || null,
          slots: Array.isArray(cfg.reservations?.slots) ? cfg.reservations.slots : null,
          blockedDates: Array.isArray(cfg.reservations?.blocked_dates)
            ? cfg.reservations.blocked_dates.filter((d: any) => typeof d === "string")
            : [],
          leadHours: Number.isFinite(cfg.reservations?.lead_hours) ? Number(cfg.reservations.lead_hours) : null,
          maxDays: Number.isFinite(cfg.reservations?.max_days) ? Number(cfg.reservations.max_days) : null,
        });
      } catch (e: any) {
        if (active) setError(e?.message || "No se pudo cargar la configuración");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const availableDates = useMemo(() => {
    if (!config?.enabled) return [];
    const dates: Array<{ date: string; blocked: boolean }> = [];
    const today = new Date();
    const maxDays = config?.maxDays && config.maxDays > 0 ? config.maxDays : 30;
    const blockedSet = new Set((config?.blockedDates || []).map((d) => d.trim()));
    for (let i = 0; i < maxDays; i += 1) {
      const d = new Date();
      d.setDate(today.getDate() + i);
      const formatted = formatDateInput(d);
      const isBlocked = blockedSet.has(formatted);
      const key = DAY_KEYS[d.getDay()];
      const hasHours = config?.hours ? parseTramos((config.hours as any)?.[key]).length > 0 : false;
      if (config?.slots && config.slots.length > 0) {
        dates.push({ date: formatted, blocked: isBlocked });
      } else if (hasHours) {
        dates.push({ date: formatted, blocked: isBlocked });
      }
    }
    return dates;
  }, [config?.hours, config?.slots, config?.blockedDates, config?.enabled, config?.maxDays]);

  const timesForSelectedDate = useMemo(() => {
    if (!selectedDate || !config?.enabled) return [];
    const today = new Date();
    const dt = new Date(selectedDate + "T00:00:00");
    const minDate = sameDay(dt, today) ? new Date() : undefined;

    // Si hay slots personalizados, construir a partir de ellos
    if (config?.slots && config.slots.length > 0) {
      return buildSlotsFromCustom(config.slots, selectedDate, config.leadHours ?? null);
    }

    if (!config?.hours) return [];
    const key = DAY_KEYS[dt.getDay()];
    const tramos = parseTramos((config.hours as any)?.[key]);
    if (tramos.length === 0) return [];
    return buildSlots(tramos, minDate);
  }, [selectedDate, config?.slots, config?.hours, config?.enabled, config?.leadHours]);

  useEffect(() => {
    setDatesWithStatus(availableDates);
  }, [availableDates]);

  useEffect(() => {
    // Prefer the first no-bloqueada
    if (!selectedDate && datesWithStatus.length > 0) {
      const firstAllowed = datesWithStatus.find((d) => !d.blocked)?.date || datesWithStatus[0].date;
      setSelectedDate(firstAllowed);
    }
  }, [datesWithStatus, selectedDate]);

  useEffect(() => {
    if (timesForSelectedDate.length > 0) {
      setSelectedTime(timesForSelectedDate[0]);
      setUiHint(null);
    } else {
      setSelectedTime("");
      if (selectedDate) {
        const blocked = config?.blockedDates?.includes(selectedDate);
        if (blocked) {
          setUiHint("No se aceptan reservas en esta fecha.");
        } else if (config?.slots && config.slots.length > 0) {
          setUiHint("No hay horarios disponibles para esta fecha.");
        } else {
          setUiHint("La fecha seleccionada no tiene horario disponible.");
        }
      } else {
        setUiHint(null);
      }
    }
  }, [timesForSelectedDate, selectedDate, config?.blockedDates, config?.slots]);

  async function submitReservation(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDate || !selectedTime) {
      setMessage("Selecciona una fecha y hora disponibles.");
      return;
    }
    if (!customerName || !customerPhone) {
      setMessage("Indica tu nombre y teléfono.");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const tenantSlug = resolveTenantSlugClient();
      if (tenantSlug) persistTenantSlugClient(tenantSlug);
      const endpoint = tenantSlug ? `/api/reservations?tenant=${encodeURIComponent(tenantSlug)}` : "/api/reservations";
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          time: selectedTime,
          name: customerName,
          phone: customerPhone,
          email: customerEmail,
          people,
          notes,
          tzOffsetMinutes: new Date().getTimezoneOffset(),
        }),
      });
      const j = await resp.json();
      if (!resp.ok || !j?.ok) {
        throw new Error(j?.message || "No se pudo registrar la reserva");
      }
      setMessage("¡Reserva enviada! Te confirmaremos por correo.");
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setNotes("");
    } catch (err: any) {
      setMessage(err?.message || "No se pudo enviar la reserva");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center">
        <div className="text-sm text-slate-600">Cargando configuración…</div>
      </main>
    );
  }

  if (error || !config?.enabled) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md rounded border bg-white p-6 text-center shadow">
          <h1 className="text-xl font-semibold mb-2">Reservas no disponibles</h1>
          <p className="text-sm text-slate-600">{error || "El restaurante no acepta reservas online en este momento."}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <header className="mb-8 text-center space-y-2">
        {config.businessLogo && <img src={config.businessLogo} alt={config.businessName} className="mx-auto h-20 object-contain" />}
        <h1 className="text-3xl font-semibold">{config.businessName}</h1>
        <p className="text-sm text-slate-600">Reserva tu mesa en pocos pasos.</p>
      </header>

      <form onSubmit={submitReservation} className="grid gap-6 md:grid-cols-[1.1fr,0.9fr]">
        <section className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Selecciona fecha y hora</h2>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Día</label>
            <select
              className="w-full rounded border px-3 py-2"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            >
              {datesWithStatus.length === 0 && <option>No hay fechas disponibles</option>}
              {datesWithStatus.map(({ date, blocked }) => {
                const dt = new Date(date + "T00:00:00");
                return (
                  <option key={date} value={date} disabled={blocked}>
                    {DAY_LABELS[dt.getDay()]} {dt.toLocaleDateString("es-ES")}
                    {blocked ? " — No se aceptan reservas" : ""}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Hora</label>
            <select
              className="w-full rounded border px-3 py-2"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              disabled={timesForSelectedDate.length === 0}
            >
              {timesForSelectedDate.length === 0 ? <option>No hay horarios disponibles</option> : null}
              {timesForSelectedDate.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
            {uiHint && <p className="text-xs text-amber-600">{uiHint}</p>}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Tus datos</h2>
          <div>
            <label className="text-sm font-medium text-slate-700">Nombre</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Teléfono</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Email (opcional)</label>
            <input
              type="email"
              className="mt-1 w-full rounded border px-3 py-2"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Número de comensales</label>
            <input
              type="number"
              min={1}
              max={20}
              className="mt-1 w-full rounded border px-3 py-2"
              value={people}
              onChange={(e) => setPeople(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Notas adicionales (opcional)</label>
            <textarea
              className="mt-1 w-full rounded border px-3 py-2"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Alergias, preferencias, etc."
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-emerald-600 py-2 text-white font-medium hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? "Enviando reserva…" : "Enviar reserva"}
          </button>
          {message && <p className="text-sm text-center text-slate-600">{message}</p>}
        </section>
      </form>
    </main>
  );
}
