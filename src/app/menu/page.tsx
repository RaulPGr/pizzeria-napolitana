// src/app/menu/page.tsx
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import AddToCartButton from '@/components/AddToCartButton';
import { headers } from 'next/headers';

function formatPrice(n: number) {
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
  } catch {
    return `${n.toFixed(2)} €`;
  }
}

// Next 15 tipa searchParams como Promise
type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MenuPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const rawCat = sp?.cat;
  const selectedCat = (Array.isArray(rawCat) ? (rawCat[0] ?? '') : (rawCat ?? '')).toLowerCase();
  const rawDay = sp?.day;
  const selectedDay = Number(Array.isArray(rawDay) ? (rawDay[0] ?? '') : (rawDay ?? ''));

  // SSR fetch to internal API, preserving cookies for tenant
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

  // Agrupar por categoría
  const groups = new Map<number | 'nocat', any[]>();
  (products || []).forEach((p: any) => {
    const key = (p.category_id ?? 'nocat') as number | 'nocat';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  });

  // Secciones: categorías + "Otros" si procede
  const orderedSections: Array<{ id: number | 'nocat'; name: string; sort_order?: number }> = [
    ...(categories || []),
    ...(groups.has('nocat') ? [{ id: 'nocat' as const, name: 'Otros', sort_order: 9999 }] : []),
  ];

  // Filtro de categoría
  const visibleSections = orderedSections.filter((s) => {
    if (!selectedCat) return true;
    if (selectedCat === 'nocat') return s.id === 'nocat';
    return String(s.id) === selectedCat;
  });

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <h1 className="mb-6 text-3xl font-semibold">Menú</h1>

      {menuMode === 'daily' && (
        <DayTabs selectedDay={selectedDay} />
      )}

      {/* Filtros por categoría */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <FilterPill href="/menu" active={!selectedCat}>
          Todos
        </FilterPill>

        {orderedSections.map((s) => {
          const href =
            s.id === 'nocat'
              ? '/menu?cat=nocat'
              : `/menu?cat=${encodeURIComponent(String(s.id))}`;
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
          <div className="font-medium">No se pudo cargar el menú</div>
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
                const out = p.available === false; // agotado

                return (
                  <li
                    key={p.id}
                    className={[
                      'relative overflow-hidden rounded border bg-white',
                      out ? 'opacity-60' : '',
                    ].join(' ')}
                  >
                    {/* Etiqueta AGOTADO */}
                    {out && (
                      <span className="absolute left-2 top-2 rounded bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white shadow">
                        Agotado
                      </span>
                    )}

                    {/* Imagen */}
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
                          className={[
                            'whitespace-nowrap font-semibold',
                            out ? 'text-slate-500 line-through' : 'text-emerald-700',
                          ].join(' ')}
                        >
                          {formatPrice(Number(p.price || 0))}
                        </span>
                      </div>

                      {p.description && (
                        <p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">
                          {p.description}
                        </p>
                      )}

                      <AddToCartButton
                        product={{ id: p.id, name: p.name, price: Number(p.price || 0), image_url: p.image_url || undefined }}
                        disabled={out}
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

/** Pill de filtro */
function FilterPill({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        'rounded-full border px-3 py-1 text-sm transition-colors',
        active
          ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
      ].join(' ')}
    >
      {children}
    </Link>
  );
}

function DayTabs({ selectedDay }: { selectedDay?: number }) {
  const now = new Date();
  const jsDay = now.getDay(); // 0..6 (Sun..Sat)
  const today = ((jsDay + 6) % 7) + 1; // 1..7 Mon..Sun
  const current = (selectedDay && selectedDay >= 1 && selectedDay <= 7) ? selectedDay : today;
  const days = [
    { d: 1, label: 'L' },
    { d: 2, label: 'M' },
    { d: 3, label: 'X' },
    { d: 4, label: 'J' },
    { d: 5, label: 'V' },
    { d: 6, label: 'S' },
    { d: 7, label: 'D' },
  ];
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {days.map(({ d, label }) => (
        <Link
          key={d}
          href={`/menu?day=${d}`}
          className={[
            'rounded-full border px-3 py-1 text-sm transition-colors',
            d === current
              ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
          ].join(' ')}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

