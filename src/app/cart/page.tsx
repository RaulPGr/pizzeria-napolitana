// /src/app/cart/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CartItem, subscribe, setQty, removeItem, clearCart } from "@/lib/cart-storage";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";

type PaymentMethod = "cash" | "card";

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function CartPage() {
  const router = useRouter();
  // Carrito
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => {
    const unsub = subscribe((next) => setItems(next));
    return () => unsub();
  }, []);
  const total = useMemo(() => items.reduce((acc, it) => acc + it.price * it.qty, 0), [items]);

  // Formulario
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [methods, setMethods] = useState<{ cash: boolean; card: boolean }>({ cash: true, card: true });
  const [sending, setSending] = useState(false);
  // Horario de pedidos (ordering_hours || opening_hours)
  const [schedule, setSchedule] = useState<any | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  // Estado actual: ¿aceptamos pedidos ahora?
  const [ordersOpenNow, setOrdersOpenNow] = useState<boolean | null>(null);

  // Cargar métodos de pago
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings/payments', { cache: 'no-store' });
        const j = await res.json();
        if (j?.ok && j?.data) {
          setMethods({ cash: !!j.data.cash, card: !!j.data.card });
          setPayment((prev) => {
            if (prev === 'cash' && j.data.cash) return 'cash';
            if (prev === 'card' && j.data.card) return 'card';
            return j.data.cash ? 'cash' : 'card';
          });
        }
      } catch {}
    })();
  }, []);

  // Cargar horario de pedidos
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings/schedule', { cache: 'no-store' });
        const j = await res.json();
        if (j?.ok) setSchedule(j.data || null);
      } catch {}
    })();
  }, []);

  // Helpers de validación
  function isDateInSchedule(date: Date, sched: any | null): boolean {
    try {
      if (!sched) return true;
      const dayKey = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][date.getDay()];
      const list: Array<{ abre?: string; cierra?: string; open?: string; close?: string }> = sched?.[dayKey] || [];
      if (!Array.isArray(list) || list.length === 0) return false;
      const mins = date.getHours() * 60 + date.getMinutes();
      return list.some((t) => {
        const a = (t.abre ?? t.open) as string | undefined;
        const c = (t.cierra ?? t.close) as string | undefined;
        if (!a || !c) return false;
        const [ha, ma] = String(a).split(':').map(Number);
        const [hc, mc] = String(c).split(':').map(Number);
        const from = ha * 60 + ma;
        const to = hc * 60 + mc;
        return mins >= from && mins < to;
      });
    } catch {
      return true;
    }
  }
  function isTimeInSchedule(dateISO: string, timeHHMM: string, sched: any | null): boolean {
    try {
      if (!sched) return true; // sin restricciones
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO) || !/^\d{2}:\d{2}$/.test(timeHHMM)) return true;
      const [y, m, d] = dateISO.split('-').map(Number);
      const [hh, mi] = timeHHMM.split(':').map(Number);
      const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mi || 0);
      const dayKey = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][dt.getDay()];
      const list: Array<{ abre?: string; cierra?: string; open?: string; close?: string }> = sched?.[dayKey] || [];
      if (!Array.isArray(list) || list.length === 0) return false;
      const mins = hh * 60 + mi;
      return list.some((t) => {
        const a = (t.abre ?? t.open) as string | undefined;
        const c = (t.cierra ?? t.close) as string | undefined;
        if (!a || !c) return false;
        const [ha, ma] = String(a).split(':').map(Number);
        const [hc, mc] = String(c).split(':').map(Number);
        const from = ha * 60 + ma;
        const to = hc * 60 + mc;
        return mins >= from && mins < to;
      });
    } catch {
      return true;
    }
  }

  function formatDaySchedule(dateISO: string, sched: any | null): string {
    try {
      if (!sched) return 'Sin restricciones específicas.';
      const [y, m, d] = dateISO.split('-').map(Number);
      const dt = new Date(y, (m || 1) - 1, d || 1);
      const dayKey = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][dt.getDay()];
      const list: Array<{ abre?: string; cierra?: string; open?: string; close?: string }> = sched?.[dayKey] || [];
      if (!Array.isArray(list) || list.length === 0) return 'Cerrado';
      return list.map((t) => `${t.abre ?? t.open}–${t.cierra ?? t.close}`).join(', ');
    } catch {
      return '';
    }
  }

  // Validar cada cambio de fecha/hora
  useEffect(() => {
    if (!time) { setTimeError(null); return; }
    const ok = isTimeInSchedule(date, time, schedule);
    setTimeError(ok ? null : 'Fuera del horario de pedidos');
  }, [date, time, schedule]);

  // Calcular si AHORA se aceptan pedidos; refrescar cada minuto
  useEffect(() => {
    function tick() {
      setOrdersOpenNow(isDateInSchedule(new Date(), schedule));
    }
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [schedule]);

  const submitReason = (() => {
    if (items.length === 0) return 'Añade algún producto al carrito';
    if (name.trim().length === 0) return 'Introduce tu nombre';
    if (phone.trim().length === 0) return 'Introduce un teléfono de contacto';
    if (date.trim().length === 0) return 'Selecciona fecha de recogida';
    if (time.trim().length === 0) return 'Selecciona hora de recogida';
    if (timeError) return timeError;
    if (sending) return 'Enviando…';
    return null;
  })();

  const canSubmit = submitReason === null;

  // Envío
  async function onConfirm() {
    if (!canSubmit) return;

    // Validación fecha/hora
    const timeOk = /^\d{2}:\d{2}$/.test(time);
    if (!timeOk) {
      alert("Introduce una hora válida (HH:MM).");
      return;
    }
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mi] = time.split(":").map(Number);
    const pickup = new Date(y, (m || 1) - 1, d || 1, hh || 0, mi || 0);
    if (isNaN(pickup.getTime())) {
      alert("La fecha y hora no son válidas.");
      return;
    }

    const payload = {
      customer: { name: name.trim(), phone: phone.trim(), email: email.trim() || undefined },
      notes: notes.trim() || undefined,
      pickupAt: pickup.toISOString(),
      paymentMethod: payment,
      items: items.map((it) => ({ productId: it.id as number, quantity: it.qty })),
    } as const;

    try {
      setSending(true);
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const j = (await res.json().catch(() => ({}))) as any;
      clearCart();
      if (j?.orderId) {
        router.replace(`/order/${j.orderId}`);
      } else {
        alert("Pedido creado correctamente");
      }
    } catch (e: any) {
      alert(`No se pudo crear el pedido. ${e?.message ?? ""}`);
    } finally {
      setSending(false);
    }
  }

  // UI
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">Tu carrito</h1>

      {/* LÍNEAS DEL CARRITO */}
      <div className="mb-6">
        {items.length === 0 ? (
          <div className="rounded border bg-white p-4 text-gray-600 shadow">Tu carrito está vacío.</div>
        ) : (
          <ul className="space-y-3">
            {items.map((it) => (
              <li key={String(it.id)} className="rounded border bg-white p-3 shadow">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {it.image && <img src={it.image} alt={it.name} className="h-12 w-12 rounded object-cover" />}
                    <div>
                      <div className="font-medium">{it.name}</div>
                      <div className="text-sm text-gray-500">{it.price.toFixed(2)} €</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setQty(it.id, Math.max(1, it.qty - 1))} className="rounded border px-2 py-1">
                      -
                    </button>
                    <span className="w-8 text-center">{it.qty}</span>
                    <button onClick={() => setQty(it.id, it.qty + 1)} className="rounded border px-2 py-1">
                      +
                    </button>
                    <button onClick={() => removeItem(it.id)} className="rounded border border-red-300 px-3 py-1 text-red-600">
                      Quitar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* TOTAL */}
      <div className="mb-6 flex items-center justify-end rounded border bg-white p-4 shadow">
        <div className="text-lg">
          <span className="font-semibold">Total: </span>
        </div>
        <div className="ml-2 text-lg">{total.toFixed(2)} €</div>
      </div>

      {/* FORMULARIO */}
      <section className="rounded border bg-white p-4 shadow">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Datos del cliente</h2>
          {ordersOpenNow === false ? (
            <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">Ahora no se aceptan pedidos</span>
          ) : ordersOpenNow === true ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">Aceptando pedidos</span>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-gray-600">Nombre</label>
            <input className="w-full rounded border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del cliente" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">Teléfono</label>
            <input className="w-full rounded border px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono de contacto" inputMode="tel" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">Email (opcional)</label>
            <input className="w-full rounded border px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@email.com" type="email" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">Notas (opcional)</label>
            <input className="w-full rounded border px-3 py-2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sin cebolla, alergias, etc." />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">Fecha de recogida</label>
            <input type="date" className="w-full rounded border px-3 py-2" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">Hora de recogida</label>
            <input type="time" className="w-full rounded border px-3 py-2" value={time} onChange={(e) => setTime(e.target.value)} />
            <div className="mt-1 text-xs text-gray-600">Horario para este día: {formatDaySchedule(date, schedule)}</div>
            {time && timeError && <div className="mt-1 text-xs text-red-600">{timeError}</div>}
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 text-sm text-gray-600">Método de pago</div>
          {methods.cash && (
            <label className="mr-6 inline-flex items-center gap-2">
              <input type="radio" name="payment" checked={payment === "cash"} onChange={() => setPayment("cash")} />
              Pago en tienda
            </label>
          )}
          {methods.card && (
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="payment" checked={payment === "card"} onChange={() => setPayment("card")} />
              Tarjeta
            </label>
          )}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <ConfirmSubmitButton onClick={onConfirm} disabled={!canSubmit} title={submitReason || undefined} />
          <button onClick={() => clearCart()} disabled={items.length === 0} className="rounded border px-4 py-2 disabled:opacity-50" type="button">
            Vaciar carrito
          </button>
        </div>
        {(!canSubmit && submitReason) && (
          <div className="mt-2 text-xs text-red-600">No puedes confirmar: {submitReason}.</div>
        )}
        {ordersOpenNow === false && !timeError && time && (
          <div className="mt-2 text-xs text-gray-600">El local no acepta pedidos ahora, pero tu hora de recogida seleccionada está dentro del horario.</div>
        )}
      </section>
    </main>
  );
}
