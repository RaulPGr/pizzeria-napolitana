// src/app/menu/page.tsx
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
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
  const rawTenant = (sp as any)?.tenant as string | string[] | undefined;
  const tenant = (Array.isArray(rawTenant) ? (rawTenant[0] ?? '') : (rawTenant ?? '')).toLowerCase();

  // Si no se especifica ?day, redirigir al día actual (1..7 ISO)
  // Preservamos ?cat si viene en la URL. No tocamos cuando day=0 ("Todos los días").
  if (rawDay == null || (Array.isArray(rawDay) && rawDay[0] == null) || (typeof rawDay === 'string' && rawDay.trim() === '')) {
    const now = new Date();
    const jsDay = now.getDay(); // 0..6 (Sun..Sat)
    const todayIso = ((jsDay + 6) % 7) + 1; // 1..7 (Mon..Sun)
    const params = new URLSearchParams();
    params.set('day', String(todayIso));
    if (selectedCat) params.set('cat', selectedCat === 'nocat' ? 'nocat' : selectedCat);
    redirect(`/menu?${params.toString()}`);
  }

  const h = await headers();
  const cookie = h.get('cookie') ?? '';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host = h.get('host');
  const baseUrl = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');
  const apiUrl = new URL('/api/products', baseUrl);
  if (selectedDay >= 1 && selectedDay <= 7) apiUrl.searchParams.set('day', String(selectedDay));
  if (tenant) apiUrl.searchParams.set('tenant', tenant);
  const resp = await fetch(String(apiUrl), { cache: 'no-store', headers: { cookie } });
  const payload = await resp.json();
  const products = (payload?.products || []) as any[];
  const categories = (payload?.categories || []) as any[];
  const menuMode = (payload?.menu_mode as 'fixed' | 'daily') || 'fixed';
  const error = resp.ok ? null : { message: payload?.error || 'Error' };

  // Cargar horario de pedidos para saber qué días mostrar en las pestañas
  let openDaysISO: number[] | null = null;
  try {
    const schedUrl = new URL('/api/settings/schedule', baseUrl);
    if (tenant) schedUrl.searchParams.set('tenant', tenant);
    const sRes = await fetch(String(schedUrl), { cache: 'no-store', headers: { cookie } });
    const sj = await sRes.json();
    const schedule = sj?.ok ? (sj?.data || null) : null;
    if (schedule) {
      const keyToIso: Record<string, number> = {
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
        sunday: 7,
      };
      const days: number[] = [];
      for (const [k, v] of Object.entries(schedule)) {
        const iso = (keyToIso as any)[k];
        if (!iso) continue;
        const list = Array.isArray(v) ? v : [];
        if (list.length > 0) days.push(iso);
      }
      openDaysISO = days.sort((a, b) => a - b);
    }
  } catch {}

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
        <DayTabs selectedDay={selectedDay} hasAllDays={hasAllDays} openDaysISO={openDaysISO || undefined} />
      )}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {(() => {
          const validDay = typeof selectedDay === 'number' && !Number.isNaN(selectedDay) && selectedDay >= 0 && selectedDay <= 7;
          const dayParam = validDay ? `?day=${encodeURIComponent(String(selectedDay))}` : '';
          const href = `/menu${dayParam}`;
          return (
            <FilterPill href={href} active={!selectedCat}>Todos</FilterPill>
          );
        })()}
        {orderedSections.map((s) => {
          const validDay = typeof selectedDay === 'number' && !Number.isNaN(selectedDay) && selectedDay >= 0 && selectedDay <= 7;
          const dayParam = validDay ? `day=${encodeURIComponent(String(selectedDay))}` : undefined;
          const catParam = s.id === 'nocat' ? 'cat=nocat' : `cat=${encodeURIComponent(String(s.id))}`;
          const qp = [dayParam, catParam].filter(Boolean).join('&');
          const href = `/menu?${qp}`;
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

function DayTabs({ selectedDay, hasAllDays, openDaysISO }: { selectedDay?: number; hasAllDays: boolean; openDaysISO?: number[] }) {
  const now = new Date();
  const jsDay = now.getDay();
  const today = ((jsDay + 6) % 7) + 1;
  const valid = typeof selectedDay === "number" && !Number.isNaN(selectedDay) && selectedDay >= 0 && selectedDay <= 7; const current = valid ? (selectedDay as number) : today;
  const baseDays = hasAllDays
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
  const days = (() => {
    if (!openDaysISO || openDaysISO.length === 0) return baseDays;
    return baseDays.filter(({ d }) => d === 0 || openDaysISO.includes(d as number));
  })();
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





