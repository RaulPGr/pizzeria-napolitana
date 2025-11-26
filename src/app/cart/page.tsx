// /src/app/cart/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CartItem, subscribe, setQty, removeItem, clearCart } from "@/lib/cart-storage";
import { useSubscriptionPlan } from "@/context/SubscriptionPlanContext";
import { useOrdersEnabled } from "@/context/OrdersEnabledContext";
import { subscriptionAllowsOrders, type SubscriptionPlan } from "@/lib/subscription";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { persistTenantSlugClient, resolveTenantSlugClient } from "@/lib/tenant-client";
import { applyBestPromotion, type Promotion as PromotionRule } from "@/lib/promotions";

type PaymentMethod = "cash" | "card";

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Pantalla del carrito: gestiona artículos, promociones y envío del pedido.
function CartPageContent() {
  const router = useRouter();
  // Carrito
  const [items, setItems] = useState<CartItem[]>([]);
  // Suscripción a los cambios del carrito (storage/local events).
  // Carga promociones disponibles para poder aplicar el mejor descuento.
  useEffect(() => {
    const unsub = subscribe((next) => setItems(next));
    return () => unsub();
  }, []);
  const [promotions, setPromotions] = useState<PromotionRule[]>([]);
  const [promotionsLoading, setPromotionsLoading] = useState(false);
  const [promotionsError, setPromotionsError] = useState<string | null>(null);
  const promoResult = useMemo(() => applyBestPromotion(items, promotions), [items, promotions]);
  const subtotal = promoResult.subtotal;
  const discount = promoResult.discount;
  const total = promoResult.total;
  const appliedPromotion = promoResult.promotion;

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
  // Carga métodos de pago disponibles para el negocio actual.
  useEffect(() => {
    const slug = resolveTenantSlugClient();
    if (slug) {
      persistTenantSlugClient(slug);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const slug = resolveTenantSlugClient();
        if (slug) persistTenantSlugClient(slug);
        const endpoint = slug ? `/api/settings/payments?tenant=${encodeURIComponent(slug)}` : "/api/settings/payments";
        const res = await fetch(endpoint, { cache: "no-store" });
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

  // Obtener horario de pedidos para validar fecha/hora de recogida.
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        setPromotionsLoading(true);
        setPromotionsError(null);
        const slug = resolveTenantSlugClient();
        if (slug) persistTenantSlugClient(slug);
        const endpoint = slug ? `/api/promotions?tenant=${encodeURIComponent(slug)}` : "/api/promotions";
        const res = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j?.ok) throw new Error(j?.error || "No se pudieron cargar las promociones");
        const normalized = Array.isArray(j.promotions)
          ? (j.promotions as any[]).map((p) => ({
              ...p,
              value: Number(p.value ?? 0),
              min_amount: p.min_amount != null ? Number(p.min_amount) : null,
              weekdays: Array.isArray(p.weekdays) ? p.weekdays.map((n: any) => Number(n)).filter((d: number) => Number.isFinite(d)) : undefined,
            }))
          : [];
        setPromotions(normalized);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setPromotionsError(e?.message || "No se pudieron cargar las promociones");
      } finally {
        setPromotionsLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  // Cargar horario de pedidos
  useEffect(() => {
    (async () => {
      try {
        const slug = resolveTenantSlugClient();
        if (slug) persistTenantSlugClient(slug);
        const endpoint = slug ? `/api/settings/schedule?tenant=${encodeURIComponent(slug)}` : "/api/settings/schedule";
        const res = await fetch(endpoint, { cache: "no-store" });
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

  // Helpers adicionales: mínimos y validación contra pasado
  function pad2(n: number) { return String(n).padStart(2, '0'); }
  function roundUpTo5Minutes(d: Date): string {
    const stepMs = 5 * 60 * 1000;
    const up = new Date(Math.ceil(d.getTime() / stepMs) * stepMs);
    return `${pad2(up.getHours())}:${pad2(up.getMinutes())}`;
  }
  function minTimeFor(dateISO: string): string {
    try { if (dateISO === todayISO()) return roundUpTo5Minutes(new Date()); } catch {}
    return '00:00';
  }
  function isSelectedInPast(dateISO: string, timeHHMM: string): boolean {
    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO) || !/^\d{2}:\d{2}$/.test(timeHHMM)) return false;
      const [y,m,d] = dateISO.split('-').map(Number);
      const [hh,mi] = timeHHMM.split(':').map(Number);
      const when = new Date(y,(m||1)-1,d||1,hh||0,mi||0);
      return when.getTime() < Date.now();
    } catch { return false; }
  }

  // Sugerencias (UI) en saltos de 5 min, según horario si existe
  function dayWindowsMinutes(dateISO: string, sched: any | null): Array<[number, number]> | null {
    try {
      if (!sched) return null;
      const [y,m,d] = dateISO.split('-').map(Number);
      const dt = new Date(y,(m||1)-1,d||1);
      const key = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][dt.getDay()];
      const list: Array<{ abre?: string; cierra?: string; open?: string; close?: string }> = sched?.[key] || [];
      if (!Array.isArray(list) || list.length === 0) return null;
      const out: Array<[number, number]> = [];
      for (const t of list) {
        const a = String((t.abre ?? t.open) ?? '00:00');
        const c = String((t.cierra ?? t.close) ?? '23:59');
        const [ha,ma] = a.split(':').map(Number);
        const [hc,mc] = c.split(':').map(Number);
        out.push([ha*60+ma, hc*60+mc]);
      }
      return out;
    } catch { return null; }
  }

  // Genera un listado de horas posibles (salto de 5 min) dentro del horario configurado.
  const timeSuggestions: string[] = useMemo(() => {
    const minsStart = (() => {
      if (date === todayISO()) {
        const [hh, mm] = minTimeFor(date).split(':').map(Number);
        return hh*60 + mm;
      }
      return 0;
    })();
    const windows = dayWindowsMinutes(date, schedule);
    const result: string[] = [];
    const addRange = (fromMin: number, toMin: number) => {
      let m = Math.max(minsStart, fromMin);
      m = Math.ceil(m / 5) * 5;
      for (; m < toMin; m += 5) {
        const hh = Math.floor(m/60); const mi = m % 60;
        result.push(`${pad2(hh)}:${pad2(mi)}`);
      }
    };
    if (windows && windows.length > 0) {
      windows.forEach(([a,b]) => addRange(a,b));
    } else {
      // Sin horario definido: no forzamos sugerencias para no confundir.
      return [];
    }
    return result.slice(0, 288);
  }, [date, schedule]);

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
    // No permitir fechas anteriores a hoy
    if (date && date < todayISO()) setDate(todayISO());
    // Ajustar hora mínima para hoy
    if (date === todayISO()) {
      const minT = minTimeFor(date);
      if (time && time < minT) setTime(minT);
    }
    if (!time) { setTimeError(null); return; }
    const ok = isTimeInSchedule(date, time, schedule);
    if (!ok) { setTimeError('Fuera del horario de pedidos'); return; }
    if (isSelectedInPast(date, time)) { setTimeError('No puedes seleccionar una hora pasada'); return; }
    setTimeError(null);
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
    if (isSelectedInPast(date, time)) return 'No puedes seleccionar una hora pasada';
    if (timeError) return timeError;
    if (sending) return 'Enviando…';
    return null;
  })();

  const canSubmit = submitReason === null;

  // Envío
  // Envía el pedido al backend (validando campos y horarios).
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

    if (pickup.getTime() < Date.now()) {
      alert('No puedes seleccionar una hora pasada.');
      return;
    }

    const payload = {
      customer: { name: name.trim(), phone: phone.trim(), email: email.trim() || undefined },
      notes: notes.trim() || undefined,
      pickupAt: pickup.toISOString(),
      paymentMethod: payment,
      items: items.map((it) => ({
        productId: it.id as number,
        quantity: it.qty,
        unitPrice: it.price,
        options: it.options?.map((opt) => ({
          optionId: opt.optionId,
          name: opt.name,
          groupName: opt.groupName,
          price_delta: opt.price_delta ?? 0,
        })),
      })),
      pricing: {
        subtotal,
        discount,
        total,
        promotionId: appliedPromotion?.id || null,
        promotionName: appliedPromotion?.name || null,
      },
    } as const;

    try {
      setSending(true);
      const tenantSlug = resolveTenantSlugClient();
      if (tenantSlug) persistTenantSlugClient(tenantSlug);
      const endpoint = tenantSlug ? `/api/orders?tenant=${encodeURIComponent(tenantSlug)}` : "/api/orders";
      const res = await fetch(endpoint, {
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
              <li key={`${String(it.id)}-${it.variantKey || "base"}`} className="rounded border bg-white p-3 shadow">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-1 items-start gap-3">
                    {it.image && <img src={it.image} alt={it.name} className="h-12 w-12 rounded object-cover" />}
                    <div className="flex-1">
                      <div className="font-medium">{it.name}</div>
                      <div className="text-sm text-gray-500">{it.price.toFixed(2)} €</div>
                      {it.options && it.options.length > 0 && (
                        <ul className="mt-1 text-xs text-gray-600">
                          {it.options.map((opt, idx) => (
                            <li key={idx}>
                              {opt.groupName ? `${opt.groupName}: ` : ""}
                              {opt.name}
                              {opt.price_delta ? ` (+${opt.price_delta.toFixed(2)} €)` : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setQty(it.id, Math.max(1, it.qty - 1), it.variantKey || undefined)} className="rounded border px-2 py-1">
                      -
                    </button>
                    <span className="w-8 text-center">{it.qty}</span>
                    <button onClick={() => setQty(it.id, it.qty + 1, it.variantKey || undefined)} className="rounded border px-2 py-1">
                      +
                    </button>
                    <button onClick={() => removeItem(it.id, it.variantKey || undefined)} className="rounded border border-red-300 px-3 py-1 text-red-600">
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
      <div className="mb-6 rounded border bg-white p-4 shadow">
        <div className="flex flex-col items-end text-right">
          <div className="text-sm text-slate-600">
            Subtotal: <span className="font-semibold text-slate-800">{subtotal.toFixed(2)} €</span>
          </div>
          {discount > 0 && appliedPromotion ? (
            <div className="text-sm text-emerald-700">
              Promo aplicada ({appliedPromotion.name}): -{discount.toFixed(2)} €
            </div>
          ) : promotionsLoading ? (
            <div className="text-xs text-slate-500">Buscando promociones...</div>
          ) : promotionsError ? (
            <div className="text-xs text-amber-600">{promotionsError}</div>
          ) : (
            <div className="text-xs text-slate-500">No hay promociones aplicadas</div>
          )}
          <div className="mt-2 text-lg font-semibold">
            Total: <span>{total.toFixed(2)} €</span>
          </div>
        </div>
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
            <input className="w-full rounded border px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D+/g, "").slice(0, 9))} placeholder="Teléfono de contacto" inputMode="tel" maxLength={9} />
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
            <input type="date" min={todayISO()} className="w-full rounded border px-3 py-2" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">Hora de recogida</label>
            <select
              className="w-full rounded border px-3 py-2 bg-white"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={timeSuggestions.length === 0}
            >
              <option value="" disabled>
                Selecciona hora
              </option>
              {timeSuggestions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
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

function CartDisabledNotice({ plan, ordersEnabled }: { plan: SubscriptionPlan; ordersEnabled: boolean }) {
  let label = "";
  if (!subscriptionAllowsOrders(plan)) {
    label = plan === "starter" ? "Starter" : "Medium";
  } else if (!ordersEnabled) {
    label = "Premium (pedidos desactivados)";
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded border border-amber-200 bg-amber-50 p-6 text-amber-800 shadow-sm">
        <h1 className="mb-2 text-xl font-semibold">Pedidos online desactivados</h1>
        <p className="text-sm">
          Este comercio usa el plan {label}, por lo que el carrito y la recepcion de pedidos no esta disponible en esta web.
        </p>
      </div>
    </div>
  );
}



export default function CartPage() {
  const plan = useSubscriptionPlan();
  const ordersEnabled = useOrdersEnabled();
  if (!subscriptionAllowsOrders(plan) || !ordersEnabled) {
    return <CartDisabledNotice plan={plan} ordersEnabled={ordersEnabled} />;
  }
  return <CartPageContent />;
}
