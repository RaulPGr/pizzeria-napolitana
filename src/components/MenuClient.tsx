"use client";

import { useEffect, useState } from "react";
import AddToCartButton from "@/components/AddToCartButton";
import CartQtyActions from "@/components/CartQtyActions";

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

export default function MenuClient({ day }: { day: number }) {
  const [products, setProducts] = useState<any[] | null>(null);
  useEffect(() => {
    let alive = true;
    const url = new URL('/api/products', window.location.origin);
    url.searchParams.set('day', String(day));
    fetch(String(url), { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (alive) setProducts(Array.isArray(j?.products) ? j.products : []); })
      .catch(() => { if (alive) setProducts([]); });
    return () => { alive = false; };
  }, [day]);

  if (products == null) return null;
  if (!products || products.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="mb-3 text-xl font-semibold">Productos</h2>
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
              <CartQtyActions productId={p.id} allowAdd={!out} />
              {p.image_url && (<img src={p.image_url} alt={p.name} className="h-40 w-full object-cover" loading="lazy" />)}
              <div className="p-3">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-base font-medium">{p.name}</h3>
                  <span className={[ 'whitespace-nowrap font-semibold', out ? 'text-slate-500 line-through' : 'text-emerald-700' ].join(' ')}>
                    {formatPrice(Number(p.price || 0))}
                  </span>
                </div>
                {p.description && (<p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">{p.description}</p>)}
                <AddToCartButton product={{ id: p.id, name: p.name, price: Number(p.price || 0), image_url: p.image_url || undefined }} disabled={out} disabledLabel={disabledLabel} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

