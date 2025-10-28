// src/app/menu/page.tsx
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import AddToCartButton from '@/components/AddToCartButton';
import CartQtyActions from '@/components/CartQtyActions';

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

function jsToIso(jsDay: number) { return ((jsDay + 6) % 7) + 1; } // 0..6 -> 1..7

function formatPrice(n: number) {
  try { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n); }
  catch { return n.toFixed(2) + ' €'; }
}

function normalizeDays(arr: any): number[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => Number((x && typeof x === 'object') ? (x as any).day : x))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 7);
}

export default async function MenuPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const rawDay = sp?.day; // string | string[] | undefined
  const rawCat = sp?.cat;
  const selectedCat = (Array.isArray(rawCat) ? rawCat[0] : rawCat) || '';
  const selectedDay = Number(Array.isArray(rawDay) ? rawDay[0] : rawDay);

  // Si no viene ?day, redirigimos al dia actual (ISO 1..7)
  if (!(selectedDay >= 0 && selectedDay <= 7) || Number.isNaN(selectedDay)) {
    const todayIso = jsToIso(new Date().getDay());
    const qp = new URLSearchParams(); qp.set('day', String(todayIso));
    if (selectedCat) qp.set('cat', selectedCat);
    redirect(`/menu?${qp.toString()}`);
  }

  const selectedDaySafe = selectedDay;

  // Base URL para llamadas server-side
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host = h.get('host');
  const baseUrl = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');

  // Cargar productos y categorias del API
  const apiUrl = new URL('/api/products', baseUrl);
  apiUrl.searchParams.set('day', String(selectedDaySafe));
  const resp = await fetch(String(apiUrl), { cache: 'no-store' });
  const payload = await resp.json();
  const products: any[] = Array.isArray(payload?.products) ? payload.products : [];
  const categories: any[] = Array.isArray(payload?.categories) ? payload.categories : [];
  const menuMode: 'fixed' | 'daily' = (payload?.menu_mode === 'daily') ? 'daily' : 'fixed';
  const error = resp.ok ? null : { message: payload?.error || 'Error' };

  // Mostrar pestaña "Todos los dias" si hay productos 7/7
  const hasAllDays = menuMode === 'daily' && products.some((p) => normalizeDays(p.product_weekdays).length === 7);

  // Agrupar por categoria (robusto a string/number/null)
  const groups = new Map<number | 'nocat', any[]>();
  for (const p of products) {
    const cidNum = Number(p?.category_id);
    const key: number | 'nocat' = Number.isFinite(cidNum) ? cidNum : 'nocat';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  const orderedSections: Array<{ id: number | 'nocat'; name: string; sort_order?: number }>
    = [ ...(categories || []), ...(groups.has('nocat') ? [{ id: 'nocat' as const, name: 'Otros', sort_order: 9999 }] : []) ];

  const visibleSections = orderedSections.filter((s) => {
    if (!selectedCat) return true;
    if (selectedCat === 'nocat') return s.id === 'nocat';
    return String(s.id) === selectedCat;
  });

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <h1 className="mb-6 text-3xl font-semibold">Menú</h1>

      {menuMode === 'daily' && (
        <DayTabs selectedDay={selectedDaySafe} hasAllDays={hasAllDays} />
      )}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {(() => {
          const params = new URLSearchParams(); params.set('day', String(selectedDaySafe));
          return (<FilterPill href={`/menu?${params.toString()}`} active={!selectedCat}>Todos</FilterPill>);
        })()}
        {orderedSections.map((s) => {
          const params = new URLSearchParams(); params.set('day', String(selectedDaySafe));
          if (s.id === 'nocat') params.set('cat', 'nocat'); else params.set('cat', String(s.id));
          return (
            <FilterPill key={String(s.id)} href={`/menu?${params.toString()}`} active={selectedCat === (s.id === 'nocat' ? 'nocat' : String(s.id))}>
              {s.name}
            </FilterPill>
          );
        })}
      </div>

      {error && (
        <div className="mb-6 rounded border border-red-200 bg-red-50 p-3 text-red-800">
          <div className="font-medium">No se pudo cargar el Menú</div>
          <div className="text-sm">{(error as any).message}</div>
        </div>
      )}

      {visibleSections.length === 0 && !error && (
        <p className="text-slate-600">No hay productos para la categoría seleccionada.</p>
      )}

      {visibleSections.map((section) => {
        const list = section.id === 'nocat' ? (groups.get('nocat') || []) : (groups.get(section.id as number) || []);
        if (!list || list.length === 0) return null;

        return (
          <section key={String(section.id)} className="mb-10">
            {!selectedCat && (<h2 className="mb-3 text-xl font-semibold">{section.name}</h2>)}
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((p: any) => {
                const pDays = normalizeDays(p.product_weekdays);

                // Visibilidad de la tarjeta según dia seleccionado
                const showOnSelectedDay = (() => {
                  if (menuMode !== 'daily') return true;
                  if (selectedDaySafe === 0) return pDays.length === 7; // "Todos los dias": solo 7/7
                  if (selectedDaySafe >= 1 && selectedDaySafe <= 7) return pDays.includes(selectedDaySafe) || pDays.length === 7;
                  return true;
                })();
                if (!showOnSelectedDay) return null;

                // Boton activo solo si HOY corresponde (o 7/7)
                const todayIso = jsToIso(new Date().getDay());
                const canAddToday = p.available !== false && (pDays.includes(todayIso) || pDays.length === 7);
                const out = !canAddToday;
                const disabledLabel = p.available === false
                  ? 'Agotado'
                  : (!canAddToday ? (() => {
                      const names = ['', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
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

                    {p.image_url && (
                      <img src={p.image_url} alt={p.name} className="h-40 w-full object-cover" loading="lazy" />
                    )}

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
      })}
    </div>
  );
}

function FilterPill({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={[ 'rounded-full border px-3 py-1 text-sm transition-colors', active ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50' ].join(' ')}>
      {children}
    </Link>
  );
}

function DayTabs({ selectedDay, hasAllDays }: { selectedDay?: number; hasAllDays: boolean }) {
  const js = new Date().getDay(); const today = jsToIso(js);
  const current = (typeof selectedDay === 'number' && !Number.isNaN(selectedDay) && selectedDay >= 0 && selectedDay <= 7) ? selectedDay : today;
  const baseDays = hasAllDays ? [ { d:0, label:'Todos los dias' }, { d:1, label:'Lunes' }, { d:2, label:'Martes' }, { d:3, label:'Miercoles' }, { d:4, label:'Jueves' }, { d:5, label:'Viernes' }, { d:6, label:'Sabado' }, { d:7, label:'Domingo' } ] : [ { d:1, label:'Lunes' }, { d:2, label:'Martes' }, { d:3, label:'Miercoles' }, { d:4, label:'Jueves' }, { d:5, label:'Viernes' }, { d:6, label:'Sabado' }, { d:7, label:'Domingo' } ];
  return (
    <div className="mb-6 -mx-2 overflow-x-auto whitespace-nowrap py-1 px-2">
      <div className="inline-flex items-center gap-2">
        {baseDays.map(({ d, label }) => (
          <Link key={d} href={`/menu?day=${d}`} className={[ 'rounded-full border px-3 py-1 text-sm transition-colors', d === current ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50' ].join(' ')}>
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}

