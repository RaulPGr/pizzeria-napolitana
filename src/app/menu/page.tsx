// src/app/menu/page.tsx
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import AddToCartButton from '@/components/AddToCartButton';
import CartQtyActions from '@/components/CartQtyActions';
import { headers } from 'next/headers';

function formatPrice(n: number) {
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
  } catch {
    return n.toFixed(2) + ' €';
  }
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MenuPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const rawCat = sp?.cat;
  const selectedCat = (Array.isArray(rawCat) ? (rawCat[0] ?? '') : (rawCat ?? '')).toLowerCase();
  const rawDay = sp?.day;
  const selectedDay = Number(Array.isArray(rawDay) ? (rawDay[0] ?? '') : (rawDay ?? ''));

  const h = await headers();
  const cookie = h.get('cookie') ?? '';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host = h.get('host');
  const baseUrl = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');
  const apiUrl = new URL('/api/products', baseUrl);
  if (selectedDay >= 1 && selectedDay <= 7) apiUrl.searchParams.set('day', String(selectedDay));
  const resp = await fetch(String(apiUrl), { cache: 'no-store', headers: { cookie } });
  const payload = await resp.json();
  const products = (payload?.products || []) as any[];
  const categories = (payload?.categories || []) as any[];
  const menuMode = (payload?.menu_mode as 'fixed' | 'daily') || 'fixed';
  const error = resp.ok ? null : { message: payload?.error || 'Error' };

  // Mostrar pestaña "Todos los días" solo si hay productos 7/7
  const hasAllDays = menuMode === 'daily' && (products || []).some((p: any) => {
    const days: number[] = Array.isArray(p.product_weekdays)
      ? p.product_weekdays.map((x: any) => Number(x?.day)).filter((n: any) => n >= 1 && n <= 7)
      : [];
    return days.length === 7;
  });

  // Filtrado por día en modo diario (day=0 -> solo 7/7)
  const todayDefault = ((new Date().getDay() + 6) % 7) + 1;
  const filteredProducts = (() => {
    if (menuMode !== 'daily') return (products || []);
    const list = (products || []);
    if (selectedDay === 0) {
      return list.filter((p: any) => {
        const days: number[] = Array.isArray(p.product_weekdays)
          ? p.product_weekdays.map((x: any) => Number(x?.day)).filter((n: any) => n >= 1 && n <= 7)
          : [];
        return days.length === 7;
      });
    }
    const d = (typeof selectedDay === "number" && !Number.isNaN(selectedDay) && selectedDay >= 1 && selectedDay <= 7) ? Number(selectedDay) : todayDefault; if (d >= 1 && d <= 7) {
      return list.filter((p: any) => {
        const days: number[] = Array.isArray(p.product_weekdays)
          ? p.product_weekdays.map((x: any) => Number(x?.day)).filter((n: any) => n >= 1 && n <= 7)
          : [];
        return days.length === 7 || days.includes(d);
      });
    }
    return list;
  })();

  // Agrupar por categoría
  const groups = new Map<number | 'nocat', any[]>();
  filteredProducts.forEach((p: any) => {
    const key = (p.category_id ?? 'nocat') as number | 'nocat';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  });

  const orderedSections: Array<{ id: number | 'nocat'; name: string; sort_order?: number }> = [
    ...(categories || []),
    ...(groups.has('nocat') ? [{ id: 'nocat' as const, name: 'Otros', sort_order: 9999 }] : []),
  ];

  const visibleSections = orderedSections.filter((s) => {
    if (!selectedCat) return true;
    if (selectedCat === 'nocat') return s.id === 'nocat';
    return String(s.id) === selectedCat;
  });

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <h1 className="mb-6 text-3xl font-semibold">Menú</h1>

      {menuMode === 'daily' && (
        <DayTabs selectedDay={selectedDay} hasAllDays={hasAllDays} />
      )}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <FilterPill href="/menu" active={!selectedCat}>Todos</FilterPill>
        {orderedSections.map((s) => {
          const href = s.id === 'nocat' ? '/menu?cat=nocat' : `/menu?cat=${encodeURIComponent(String(s.id))}`;
          const active = selectedCat === (s.id === 'nocat' ? 'nocat' : String(s.id));
          return (
            <FilterPill key={String(s.id)} href={href} active={active}>
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
        const list =
          section.id === 'nocat'
            ? (groups.get('nocat') || [])
            : (groups.get(section.id as number) || []);

        if (!list || list.length === 0) return null;

        return (
          <section key={String(section.id)} className="mb-10">
            {!selectedCat && (
              <h2 className="mb-3 text-xl font-semibold">{section.name}</h2>
            )}

            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((p: any) => {
                const jsDay = new Date().getDay();
                const today = ((jsDay + 6) % 7) + 1; // ISO 1..7
                const pDays: number[] = Array.isArray(p.product_weekdays)
                  ? p.product_weekdays.map((x: any) => Number(x?.day)).filter((n: any) => n >= 1 && n <= 7)
                  : [];
                const allDays = pDays.length === 7;
                const availableToday = pDays.includes(today) || allDays;
                const disabledForAdd = menuMode === 'daily' ? !availableToday : false;
                const out = p.available === false || disabledForAdd;
                const disabledLabel = p.available === false ? 'Agotado' : (disabledForAdd ? 'No disponible hoy' : undefined);

                return (
                  <li
                    key={p.id}
                    className={[ 'relative overflow-hidden rounded border bg-white', out ? 'opacity-60' : '' ].join(' ')}
                  >
                    {p.available === false && (
                      <span className="absolute left-2 top-2 rounded bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white shadow">
                        Agotado
                      </span>
                    )}

                    {!availableToday && menuMode === 'daily' && (
                      <span className="absolute left-2 top-2 rounded border border-amber-700 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 shadow">
                        Disponible: {(() => {
                          const names = ['','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
                          const sorted = [...pDays].sort((a,b)=>a-b);
                          return sorted.map((d)=>names[d]).join(', ');
                        })()}
                      </span>
                    )}

                    {menuMode === 'daily' && p.available !== false && pDays.length === 0 && (
                      <span className="absolute left-2 top-2 rounded border border-slate-400 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 shadow">No disponible hoy</span>
                    )}

                    <CartQtyActions productId={p.id} allowAdd={!out} />

                    {p.image_url && (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="h-40 w-full object-cover"
                        loading="lazy"
                      />
                    )}

                    <div className="p-3">
                      <div className="flex items-baseline justify-between gap-4">
                        <h3 className="text-base font-medium">{p.name}</h3>
                        <span
                          className={[ 'whitespace-nowrap font-semibold', out ? 'text-slate-500 line-through' : 'text-emerald-700' ].join(' ')}
                        >
                          {formatPrice(Number(p.price || 0))}
                        </span>
                      </div>

                      {p.description && (
                        <p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">{p.description}</p>
                      )}

                      <AddToCartButton
                        product={{ id: p.id, name: p.name, price: Number(p.price || 0), image_url: p.image_url || undefined }}
                        disabled={out}
                        disabledLabel={disabledLabel}
                      />
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

function FilterPill({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode; }) {
  return (
    <Link
      href={href}
      className={[ 'rounded-full border px-3 py-1 text-sm transition-colors', active ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50', ].join(' ')}
    >
      {children}
    </Link>
  );
}

function DayTabs({ selectedDay, hasAllDays }: { selectedDay?: number; hasAllDays: boolean }) {
  const now = new Date();
  const jsDay = now.getDay();
  const today = ((jsDay + 6) % 7) + 1;
  const valid = typeof selectedDay === "number" && !Number.isNaN(selectedDay) && selectedDay >= 0 && selectedDay <= 7; const current = valid ? (selectedDay as number) : today;
  const days = hasAllDays
    ? [
        { d: 0, label: 'Todos los días' },
        { d: 1, label: 'Lunes' },
        { d: 2, label: 'Martes' },
        { d: 3, label: 'Miércoles' },
        { d: 4, label: 'Jueves' },
        { d: 5, label: 'Viernes' },
        { d: 6, label: 'Sábado' },
        { d: 7, label: 'Domingo' },
      ]
    : [
        { d: 1, label: 'Lunes' },
        { d: 2, label: 'Martes' },
        { d: 3, label: 'Miércoles' },
        { d: 4, label: 'Jueves' },
        { d: 5, label: 'Viernes' },
        { d: 6, label: 'Sábado' },
        { d: 7, label: 'Domingo' },
      ];
  return (
    <div className="mb-6 -mx-2 overflow-x-auto whitespace-nowrap py-1 px-2">
      <div className="inline-flex items-center gap-2">
        {days.map(({ d, label }) => (
          <Link
            key={d}
            href={`/menu?day=${d}`}
            className={[ 'rounded-full border px-3 py-1 text-sm transition-colors', d === current ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50', ].join(' ')}
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}



