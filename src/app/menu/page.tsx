// src/app/menu/page.tsx
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const PRODUCTS_TABLE   = process.env.NEXT_PUBLIC_PRODUCTS_TABLE   || 'products';
const CATEGORIES_TABLE = process.env.NEXT_PUBLIC_CATEGORIES_TABLE || 'categories';

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try { cookieStore.set(name, value, options); } catch {}
        },
        remove(name: string, options: any) {
          try { cookieStore.set(name, '', { ...options, maxAge: 0 }); } catch {}
        },
      },
    }
  );
}

function formatPrice(n: number) {
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
  } catch {
    return `${n.toFixed(2)} €`;
  }
}

/** 👇 Next 15 tipa searchParams como Promise */
type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MenuPage({ searchParams }: PageProps) {
  // 👇 ahora hay que await
  const rawCat = (await searchParams)?.cat;
  const selectedCat =
    (Array.isArray(rawCat) ? (rawCat[0] ?? '') : (rawCat ?? '')).toLowerCase(); // '', '123', 'nocat'

  const supabase = await getSupabase();

  // 1) categorías ordenadas
  const { data: categories } = await supabase
    .from(CATEGORIES_TABLE)
    .select('id,name,sort_order')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  // 2) productos activos (no filtramos por available)
  const { data: products, error } = await supabase
    .from(PRODUCTS_TABLE)
    .select('id,name,description,price,image_url,available,active,category_id,categories(name,sort_order)')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  // Agrupar por categoría
  const groups = new Map<number | 'nocat', any[]>();
  (products || []).forEach((p: any) => {
    const key = (p.category_id ?? 'nocat') as number | 'nocat';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  });

  // Secciones en orden: categorías + "Otros" si procede
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
          const active =
            selectedCat === (s.id === 'nocat' ? 'nocat' : String(s.id));
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
          <div className="text-sm">{error.message}</div>
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

                    {/* Imagen (sin next/image para evitar configurar dominios) */}
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
