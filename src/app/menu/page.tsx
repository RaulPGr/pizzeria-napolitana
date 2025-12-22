// src/app/menu/page.tsx
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import AddToCartWithOptions from '@/components/AddToCartWithOptions';
import CartQtyActions from '@/components/CartQtyActions';
import { getSubscriptionForSlug, type SubscriptionInfo } from '@/lib/subscription-server';
import { subscriptionAllowsOrders } from '@/lib/subscription';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { findPromotionForProduct, type Promotion as PromotionRule } from '@/lib/promotions';

type PageProps = { searchParams?: { [key: string]: string | string[] | undefined } };

// Convierte el número de día de JavaScript (0=domingo) al formato ISO que usamos en la carta (1=lunes).
function jsToIso(jsDay: number) { return ((jsDay + 6) % 7) + 1; }

// Determina qué día del menú debemos mostrar teniendo en cuenta la zona horaria del negocio.
function todayIsoTZ(tz?: string) {
  // ----- Productos y categorías para el día seleccionado -----
  try {
    const zone = tz || process.env.NEXT_PUBLIC_TIMEZONE || 'Europe/Madrid';
    const wd = new Intl.DateTimeFormat('en-GB', { timeZone: zone, weekday: 'short' }).format(new Date());
    const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    return map[wd] || jsToIso(new Date().getDay());
  } catch {
    return jsToIso(new Date().getDay());
  }
}

function formatPrice(n: number) {
  try { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n); }
  catch { return n.toFixed(2) + ' EUR'; }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  const timer = new Promise<T>((resolve) => {
    setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timer]);
}

// Normaliza la lista de días que viene desde la API (pueden ser objetos o números).
function normalizeDays(arr: any): number[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => Number((x && typeof x === 'object') ? (x as any).day : x))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 7);
}

// Página principal de la carta (modo tarjetas o listado).
export default async function MenuPage({ searchParams }: PageProps) {
  const sp = searchParams || {};
  const rawDay = sp?.day; const rawCat = sp?.cat;
  const selectedCat = (Array.isArray(rawCat) ? rawCat[0] : rawCat) || '';
  const selectedDay = Number(Array.isArray(rawDay) ? rawDay[0] : rawDay);

  if (!(selectedDay >= 0 && selectedDay <= 7) || Number.isNaN(selectedDay)) {
    const today = todayIsoTZ();
    const qp = new URLSearchParams(); qp.set('day', String(today));
    if (selectedCat) qp.set('cat', selectedCat);
    redirect(`/menu?${qp.toString()}`);
  }

  const selectedDaySafe = selectedDay;

  // Build absolute URL preserving subdomain (tenant)
  const hdrs = await headers();
  const proto = (hdrs.get('x-forwarded-proto') || 'https').split(',')[0].trim();
  const host = (hdrs.get('host') || '').trim();
  const origin = host ? `${proto}://${host}` : '';
  const cookieStore = await cookies();
  let slug = '';
  try { slug = cookieStore.get('x-tenant-slug')?.value || ''; } catch {}
  if (!slug && host) {
    const parts = host.split('.');
    if (parts.length >= 3) slug = parts[0].toLowerCase();
  }
  // Esta llamada nos dice si el negocio tiene plan suficiente para aceptar pedidos online.
  const { plan, ordersEnabled } = await withTimeout<SubscriptionInfo>(
    getSubscriptionForSlug(slug),
    3000,
    { plan: 'premium', ordersEnabled: true }
  );
  const allowOrdering = subscriptionAllowsOrders(plan) && ordersEnabled;

  let menuLayout: "cards" | "list" = "cards";
  if (slug) {
    try {
      const { data: themeRow } = await withTimeout(
        supabaseAdmin
          .from("businesses")
          .select("theme_config")
          .eq("slug", slug)
          .maybeSingle(),
        3000,
        { data: null } as any
      );
      const layout = (themeRow as any)?.theme_config?.menu?.layout;
      if (layout === "list") menuLayout = "list";
    } catch {}
  }
  const qps = new URLSearchParams();
  qps.set('day', String(selectedDaySafe));
  let tenantParam = '';
  if (host) {
    const parts = host.split('.');
    if (parts.length >= 3) {
      tenantParam = parts[0];
      qps.set('tenant', tenantParam);
    }
  }
  const apiUrl = origin ? `${origin}/api/products?${qps.toString()}` : `/api/products?${qps.toString()}`;

  let products: any[] = [];
  let categories: any[] = [];
  let menuMode: 'fixed' | 'daily' = 'fixed';
  let error: { message: string } | null = null;
  let payload: any = null;
  // ----- Promociones aplicables al negocio -----
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(apiUrl, { cache: 'no-store', signal: controller.signal });
    clearTimeout(timer);
    try { payload = await resp.json(); } catch {}
    products = Array.isArray(payload?.products) ? payload.products : [];
    categories = Array.isArray(payload?.categories) ? payload.categories : [];
    menuMode = (payload?.menu_mode === 'daily') ? 'daily' : 'fixed';
    error = resp.ok ? null : { message: (payload && payload.error) ? payload.error : `HTTP ${resp?.status}` };
  } catch (e: any) {
    error = { message: e?.message || 'Fetch error' };
  }

  let promotions: PromotionRule[] = [];
  try {
    const promoParams = new URLSearchParams();
    if (tenantParam) promoParams.set('tenant', tenantParam);
    const promoQuery = promoParams.toString();
    const promoUrl = origin
      ? `${origin}/api/promotions${promoQuery ? `?${promoQuery}` : ''}`
      : `/api/promotions${promoQuery ? `?${promoQuery}` : ''}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(promoUrl, { cache: 'no-store', signal: controller.signal });
    clearTimeout(timer);
    const pj = await resp.json().catch(() => ({}));
    if (resp.ok && Array.isArray(pj?.promotions)) {
      promotions = pj.promotions as PromotionRule[];
    }
  } catch {}

  // Filtramos de nuevo por día, por si la API devuelve productos extra y para soportar el selector "Todos".
  const viewProducts = (menuMode === 'daily')
    ? (products || []).filter((p: any) => {
        const pDays = normalizeDays(p?.product_weekdays);
        if (selectedDaySafe === 0) return pDays.length === 0 || pDays.length === 7; // only 7/7 or sin dias
        if (pDays.length === 0) return true;
        return pDays.length === 7 || pDays.includes(selectedDaySafe);
      })
    : (products || []);

  // Agrupamos los productos por categoría para renderizarlos en secciones.
  const groups = new Map<number | 'nocat', any[]>();
  for (const p of viewProducts) {
    const cidNum = Number(p?.category_id);
    const key: number | 'nocat' = Number.isFinite(cidNum) ? cidNum : 'nocat';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  const hasAllDays = menuMode === 'daily' && products.some((p) => {
    const days = normalizeDays(p.product_weekdays);
    return days.length === 0 || days.length === 7;
  });

  const orderedSections: Array<{ id: number | 'nocat'; name: string; sort_order?: number }>
    = [ ...(categories || []), ...(groups.has('nocat') ? [{ id: 'nocat' as const, name: 'Otros', sort_order: 9999 }] : []) ];

  const visibleSections = orderedSections.filter((s) => {
    if (!selectedCat) return true;
    if (selectedCat === 'nocat') return s.id === 'nocat';
    return String(s.id) === selectedCat;
  });

  const isListLayout = menuLayout === "list";
  const dayNames = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const currentIsoDay = ((new Date().getDay() + 6) % 7) + 1;

  const promotionCache = new Map<string, PromotionRule | null>();
  // Determina si un producto tiene alguna promoción activa.
  function getProductPromotion(p: any) {
    if (!promotions.length) return null;
    const key = `${p.id}-${p.category_id ?? 'nocat'}-${p.price ?? ''}`;
    if (promotionCache.has(key)) {
      const cached = promotionCache.get(key);
      return cached || null;
    }
    const promo = findPromotionForProduct(
      { id: p.id, price: Number(p.price || 0), category_id: p.category_id ?? null },
      promotions
    );
    promotionCache.set(key, promo);
    return promo;
  }

  // Calcula el precio final tras aplicar la promoción (si la hay).
  function getEffectivePrice(price: number, promo: PromotionRule | null) {
    if (!promo) return price;
    const value = Number(promo.value || 0);
    if (!Number.isFinite(value) || value <= 0) return price;
    if (promo.type === "percent") {
      const pct = Math.min(Math.max(value, 0), 100);
      return Math.max(0, price - (price * pct) / 100);
    }
    return Math.max(0, price - value);
  }

  // Reglas para saber si se puede añadir al carrito (agotado o fuera del día correspondiente).
  function availabilityFor(p: any) {
    if (p.available === false) {
      return { out: true, disabledLabel: "Agotado" as string | undefined };
    }
    if (menuMode !== "daily") {
      return { out: false, disabledLabel: undefined as string | undefined };
    }
    const pDays = normalizeDays(p?.product_weekdays);
    if (!pDays.length || pDays.length === 7) {
      return { out: false, disabledLabel: undefined as string | undefined };
    }
    const targetDay = selectedDaySafe >= 1 && selectedDaySafe <= 7 ? selectedDaySafe : currentIsoDay;
    const canAdd = pDays.includes(targetDay);
    let disabledLabel: string | undefined;
    if (!canAdd) {
      const sorted = [...pDays].sort((a, b) => a - b);
      disabledLabel =
        sorted.length === 1
          ? `Solo disponible ${dayNames[sorted[0]]}`
          : `Solo disponible: ${sorted.map((d) => dayNames[d]).join(", ")}`;
    }
    return { out: !canAdd, disabledLabel };
  }

  // Tarjeta de producto en el layout de "tarjetas".
  function renderProductCard(p: any) {
    const { out, disabledLabel } = availabilityFor(p);
    const promo = getProductPromotion(p);
    const priceValue = Number(p.price || 0);
    const effectivePrice = getEffectivePrice(priceValue, promo);
    const showPrice = Number.isFinite(priceValue) && priceValue > 0;
    return (
      <li
        key={p.id}
        className={['relative flex h-full flex-col overflow-hidden rounded border bg-white', out ? 'opacity-60' : ''].join(' ')}
      >
        {(p.available === false || promo) && (
          <div className="absolute left-2 top-2 flex flex-col gap-1">
            {p.available === false && (
              <span className="rounded bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white shadow">Agotado</span>
            )}
            {promo && (
              <span className="rounded bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white shadow">
                {promo.name || 'Promoción'}
              </span>
            )}
          </div>
        )}
        {allowOrdering && !(Array.isArray(p.option_groups) && p.option_groups.length > 0) && (
          <CartQtyActions productId={p.id} allowAdd={!out} />
        )}
        {p.image_url && (
          <img src={p.image_url} alt={p.name} className="h-40 w-full object-cover" loading="lazy" />
        )}
        <div className="flex flex-1 flex-col p-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <h3 className="text-base font-medium break-words">{p.name}</h3>
            {showPrice && (
              <div className="text-right sm:text-left">
                {promo ? (
                  <>
                    <span className="block text-sm text-slate-500 line-through">{formatPrice(priceValue)}</span>
                    <span className="block whitespace-nowrap font-semibold text-emerald-700">{formatPrice(effectivePrice)}</span>
                  </>
                ) : (
                  <span className={['whitespace-nowrap font-semibold', out ? 'text-slate-500 line-through' : 'text-emerald-700'].join(' ')}>
                    {formatPrice(priceValue)}
                  </span>
                )}
              </div>
            )}
          </div>
          {p.description && (
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{p.description}</p>
          )}
          {allowOrdering && (
            <div className="mt-4 pt-2">
              <AddToCartWithOptions
                product={{
                  id: p.id,
                  name: p.name,
                  price: Number(p.price || 0),
                  image_url: p.image_url || undefined,
                  category_id: p.category_id ?? null,
                  option_groups: Array.isArray(p.option_groups) ? p.option_groups : [],
                }}
                disabled={out}
                disabledLabel={disabledLabel}
              />
            </div>
          )}
        </div>
      </li>
    );
  }

  // Fila de producto cuando la carta está en modo "listado compacto".
  function renderProductListRow(p: any) {
    const { out, disabledLabel } = availabilityFor(p);
    const promo = getProductPromotion(p);
    const priceValue = Number(p.price || 0);
    const effectivePrice = getEffectivePrice(priceValue, promo);
    const showPrice = Number.isFinite(priceValue) && priceValue > 0;
    return (
      <li
        key={p.id}
        className={[
          'relative px-4 py-3',
          out ? 'opacity-60' : '',
          allowOrdering ? 'pr-24' : '',
        ].join(' ')}
      >
        {(p.available === false || promo) && (
          <div className="absolute left-4 top-3 flex flex-col gap-1">
            {p.available === false && (
              <span className="rounded bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white shadow">Agotado</span>
            )}
            {promo && (
              <span className="rounded bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white shadow">
                {promo.name || 'Promoción'}
              </span>
            )}
          </div>
        )}
        {allowOrdering && !(Array.isArray(p.option_groups) && p.option_groups.length > 0) && (
          <CartQtyActions productId={p.id} allowAdd={!out} />
        )}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="flex flex-col flex-1 min-w-0">
              <h3 className="text-base font-medium">{p.name}</h3>
              {p.description && (
                <p className="text-sm text-slate-600">{p.description}</p>
              )}
            </div>
            {showPrice && (
              <div className="flex-shrink-0 text-right w-full sm:w-auto">
                {promo ? (
                  <>
                    <span className="block text-sm text-slate-500 line-through">{formatPrice(priceValue)}</span>
                    <span className="block whitespace-nowrap font-semibold text-emerald-700">{formatPrice(effectivePrice)}</span>
                  </>
                ) : (
                  <span className={['whitespace-nowrap font-semibold', out ? 'text-slate-500 line-through' : 'text-emerald-700'].join(' ')}>
                    {formatPrice(priceValue)}
                  </span>
                )}
              </div>
            )}
          </div>
          {allowOrdering && (
            <div className="max-w-xs">
              <AddToCartWithOptions
                product={{
                  id: p.id,
                  name: p.name,
                  price: Number(p.price || 0),
                  category_id: p.category_id ?? null,
                  option_groups: Array.isArray(p.option_groups) ? p.option_groups : [],
                }}
                disabled={out}
                disabledLabel={disabledLabel}
              />
            </div>
          )}
        </div>
      </li>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <h1 className="mb-6 text-3xl font-semibold" style={{ color: 'var(--menu-heading-color, #1f2937)' }}>Carta</h1>

     {menuMode === 'daily' && (
        <DayTabs selectedDay={selectedDaySafe} hasAllDays={hasAllDays} availableDays={(Array.isArray((payload as any)?.available_days) ? (payload as any).available_days : undefined) as any} />
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

      {(() => {
        const hasAny = Array.from(groups.values()).some((a) => Array.isArray(a) && a.length > 0);
        if (!hasAny && viewProducts && viewProducts.length > 0) {
          return (
            <section className="mb-10">
              <h2 className="mb-4 border-b border-slate-200 pb-1 text-2xl font-semibold tracking-wide md:text-3xl" style={{ color: 'var(--menu-heading-color, #1f2937)' }}>
                Productos
              </h2>
              {isListLayout ? (
                <div className="rounded border bg-white shadow-sm">
                  <ul className="divide-y divide-slate-100">
                    {viewProducts.map((p: any) => renderProductListRow(p))}
                  </ul>
                </div>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {viewProducts.map((p: any) => renderProductCard(p))}
                </ul>
              )}
            </section>
          );
        }
        return null;
      })()}

      {visibleSections.map((section) => {
        const list = section.id === 'nocat' ? groups.get('nocat') || [] : groups.get(Number(section.id)) || [];
        if (!list || list.length === 0) return null;

        return (
          <section key={String(section.id)} className="mb-10">
            {!selectedCat && (
              <h2 className="mb-4 border-b border-slate-200 pb-1 text-2xl font-semibold tracking-wide md:text-3xl" style={{ color: 'var(--menu-heading-color, #1f2937)' }}>
                {section.name}
              </h2>
            )}
            {isListLayout ? (
              <div className="rounded border bg-white shadow-sm">
                {selectedCat && (
                  <div className="border-b border-slate-100 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
                    {section.name}
                  </div>
                )}
                <ul className="divide-y divide-slate-100">
                  {list.map((p: any) => renderProductListRow(p))}
                </ul>
              </div>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((p: any) => renderProductCard(p))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

// Pastilla reutilizable para los filtros de categoría.
function FilterPill({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={[ 'rounded-full border px-3 py-1 text-sm transition-colors', active ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50' ].join(' ')}>
      {children}
    </Link>
  );
}

// Selector horizontal de días cuando la carta está en modo diario.
function DayTabs({ selectedDay, hasAllDays, availableDays }: { selectedDay?: number; hasAllDays: boolean; availableDays?: number[] }) {
  const js = new Date().getDay(); const today = jsToIso(js);
  const current = (typeof selectedDay === 'number' && !Number.isNaN(selectedDay) && selectedDay >= 0 && selectedDay <= 7) ? selectedDay : today;
  const names = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const baseDays = hasAllDays
    ? [ { d:0, label:'Todos los días' }, { d:1, label:'Lunes' }, { d:2, label:'Martes' }, { d:3, label:'Miércoles' }, { d:4, label:'Jueves' }, { d:5, label:'Viernes' }, { d:6, label:'Sábado' }, { d:7, label:'Domingo' } ]
    : [ { d:1, label:'Lunes' }, { d:2, label:'Martes' }, { d:3, label:'Miércoles' }, { d:4, label:'Jueves' }, { d:5, label:'Viernes' }, { d:6, label:'Sábado' }, { d:7, label:'Domingo' } ];
  const daysToShow = (Array.isArray(availableDays) && availableDays.length > 0)
    ? baseDays.filter((x) => x.d !== 0 && (availableDays as number[]).includes(x.d))
    : baseDays;
  return (
    <div className="mb-6 -mx-2 overflow-x-auto whitespace-nowrap py-1 px-2">
      <div className="inline-flex items-center gap-2">
        {daysToShow.map(({ d, label }) => (
          <Link key={d} href={`/menu?day=${d}`} className={[ 'rounded-full border px-3 py-1 text-sm transition-colors', d === current ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50' ].join(' ')}>
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
