"use client";

import { useEffect, useState } from "react";
import AddToCartButton from "@/components/AddToCartButton";
import CartQtyActions from "@/components/CartQtyActions";
import { useSubscriptionPlan } from "@/context/SubscriptionPlanContext";
import { useOrdersEnabled } from "@/context/OrdersEnabledContext";
import { subscriptionAllowsOrders } from "@/lib/subscription";

function normalizeDays(arr: any): number[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => Number((x && typeof x === 'object') ? (x as any).day : x))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 7);
}

function formatPrice(n: number) {
  try { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n); }
  catch { return n.toFixed(2) + ' EUR'; }
}

type Props = { day: number; categories?: any[]; selectedCat?: string };

export default function MenuClient({ day, categories: initialCats, selectedCat }: Props) {
  const [products, setProducts] = useState<any[] | null>(null);
  const [cats, setCats] = useState<any[] | null>(Array.isArray(initialCats) ? initialCats : null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const plan = useSubscriptionPlan();
  const ordersEnabled = useOrdersEnabled();
  const allowOrdering = subscriptionAllowsOrders(plan) && ordersEnabled;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError(null);
    try {
      const abs = new URL('/api/products', window.location.origin);
      abs.searchParams.set('day', String(day));
      try {
        const host = window.location.hostname;
        const parts = host.split('.');
        if (parts.length >= 3) abs.searchParams.set('tenant', parts[0]);
      } catch {}
      fetch(String(abs), { cache: 'no-store', credentials: 'same-origin', mode: 'same-origin' as RequestMode })
        .then(r => r.json())
        .then(j => {
          if (!alive) return;
          setProducts(Array.isArray(j?.products) ? j.products : []);
          if (!cats && Array.isArray(j?.categories)) setCats(j.categories);
          setLoading(false);
        })
        .catch((e) => { if (alive) { setLoadError('No se pudo cargar la carta'); setProducts([]); setLoading(false); } });
    } catch (e: any) {
      if (alive) { setLoadError('No se pudo preparar la petición'); setProducts([]); setLoading(false); }
    }
    return () => { alive = false; };
  }, [day]);

  if (loading) {
    return (
      <div className="mb-6 text-center text-sm text-slate-600">Cargando carta...</div>
    );
  }
  if (products == null) return null;
  if (!products || products.length === 0) {
    return loadError ? (
      <div className="mb-6 rounded border border-yellow-200 bg-yellow-50 p-3 text-yellow-800 text-sm">{loadError}</div>
    ) : null;
  }

  // Agrupar por categoría
  const groups = new Map<number | 'nocat', any[]>();
  for (const p of products) {
    const cidNum = Number(p?.category_id);
    const key: number | 'nocat' = Number.isFinite(cidNum) ? cidNum : 'nocat';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  const orderedSections: Array<{ id: number | 'nocat'; name: string; sort_order?: number }>
    = [ ...(cats || []), ...(groups.has('nocat') ? [{ id: 'nocat' as const, name: 'Otros', sort_order: 9999 }] : []) ];
  const visibleSections = orderedSections.filter((s) => {
    if (!selectedCat) return true;
    if (selectedCat === 'nocat') return s.id === 'nocat';
    return String(s.id) === selectedCat;
  });

  return (
    <>
      {(() => {
        const hasAny = Array.from(groups.values()).some((a) => Array.isArray(a) && a.length > 0);
        if (!hasAny && (products && products.length > 0)) {
          return (
            <section className="mb-10">
              <h2 className="mb-4 text-2xl md:text-3xl font-semibold tracking-wide text-slate-900 border-b border-slate-200 pb-1">Productos</h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((p: any) => {
                  const pDays = normalizeDays(p.product_weekdays);
                  const js = new Date().getDay();
                  const today = ((js + 6) % 7) + 1;
                  const canAddToday = p.available !== false && (pDays.includes(today) || pDays.length === 7);
                  const out = !canAddToday;
                  const disabledLabel = p.available === false
                    ? 'Agotado'
                    : (!canAddToday ? (() => {
                        const names = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
                        const sorted = [...pDays].sort((a, b) => a - b);
                        if (sorted.length === 7) return undefined;
                        if (sorted.length === 1) return `Solo disponible ${names[sorted[0]]}`;
                        return `Solo disponible: ${sorted.map((d) => names[d]).join(', ')}`;
                      })() : undefined);
                  return (
                    <li key={p.id} className={[ 'relative overflow-hidden rounded border bg-white', out ? 'opacity-60' : '' ].join(' ')}>
                      {p.available === false && (
                        <span className="absolute left-2 top-2 rounded bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white shadow">Agotado</span>
                      )}
                      {allowOrdering && <CartQtyActions productId={p.id} allowAdd={!out} />}
                      {p.image_url && (<img src={p.image_url} alt={p.name} className="h-40 w-full object-cover" loading="lazy" />)}
                      <div className="p-3">
                        <div className="flex items-baseline justify-between gap-4">
                          <h3 className="text-base font-medium">{p.name}</h3>
                          <span className={[ 'whitespace-nowrap font-semibold', out ? 'text-slate-500 line-through' : 'text-emerald-700' ].join(' ')}>
                            {formatPrice(Number(p.price || 0))}
                          </span>
                        </div>
                        {p.description && (<p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">{p.description}</p>)}
                        {allowOrdering && (
                          <AddToCartButton
                            product={{ id: p.id, name: p.name, price: Number(p.price || 0), image_url: p.image_url || undefined }}
                            disabled={out}
                            disabledLabel={disabledLabel}
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        }
        return null;
      })()}
      {visibleSections.map((section) => {
        const list = section.id === 'nocat'
          ? (groups.get('nocat') || [])
          : (groups.get(Number(section.id)) || []);
        if (!list || list.length === 0) return null;
        return (
          <section key={String(section.id)} className="mb-10">
            {!selectedCat && (
              <h2 className="mb-4 text-2xl md:text-3xl font-semibold tracking-wide text-slate-900 border-b border-slate-200 pb-1">
                {section.name}
              </h2>
            )}
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((p: any) => {
                const pDays = normalizeDays(p.product_weekdays);
                const js = new Date().getDay();
                const today = ((js + 6) % 7) + 1;
                const canAddToday = p.available !== false && (pDays.includes(today) || pDays.length === 7);
                const out = !canAddToday;
                const disabledLabel = p.available === false
                  ? 'Agotado'
                  : (!canAddToday ? (() => {
                      const names = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
                      const sorted = [...pDays].sort((a, b) => a - b);
                      if (sorted.length === 7) return undefined;
                      if (sorted.length === 1) return `Solo disponible ${names[sorted[0]]}`;
                      return `Solo disponible: ${sorted.map((d) => names[d]).join(', ')}`;
                    })() : undefined);
                return (
                  <li key={p.id} className={[ 'relative overflow-hidden rounded border bg-white', out ? 'opacity-60' : '' ].join(' ')}>
                    {p.available === false && (
                      <span className="absolute left-2 top-2 rounded bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white shadow">Agotado</span>
                    )}
                    {allowOrdering && <CartQtyActions productId={p.id} allowAdd={!out} />}
                    {p.image_url && (<img src={p.image_url} alt={p.name} className="h-40 w-full object-cover" loading="lazy" />)}
                    <div className="p-3">
                      <div className="flex items-baseline justify-between gap-4">
                        <h3 className="text-base font-medium">{p.name}</h3>
                        <span className={[ 'whitespace-nowrap font-semibold', out ? 'text-slate-500 line-through' : 'text-emerald-700' ].join(' ')}>
                          {formatPrice(Number(p.price || 0))}
                        </span>
                      </div>
                      {p.description && (<p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">{p.description}</p>)}
                      {allowOrdering && (
                        <AddToCartButton
                          product={{ id: p.id, name: p.name, price: Number(p.price || 0), image_url: p.image_url || undefined }}
                          disabled={out}
                          disabledLabel={disabledLabel}
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </>
  );
}
