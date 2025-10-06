// src/app/menu/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { addItem } from "@/lib/cart-storage";
import AddButtonWithFeedback from "@/components/AddButtonWithFeedback";

type Product = {
  id: number | string;
  nombre: string;
  precio: number;
  descripcion?: string | null;
  imagen?: string | null;
  categoria?: string | null;
  stock?: number | null;
  activo?: boolean | null;
};

// Normalización (sin cambiar funcionalidad)
function normalizeProduct(r: any): Product {
  const id = r?.id ?? r?.product_id ?? r?.code ?? crypto.randomUUID();
  const nombre = r?.nombre ?? r?.name ?? r?.title ?? r?.product_name ?? "";
  let precio: number =
    r?.precio ??
    r?.price ??
    r?.unit_price ??
    (typeof r?.unit_price_cents === "number" ? r.unit_price_cents / 100 : undefined);
  if (typeof precio !== "number" || Number.isNaN(precio)) precio = 0;

  const descripcion = r?.descripcion ?? r?.description ?? r?.details ?? null;
  const imagen = r?.imagen ?? r?.image ?? r?.image_url ?? r?.photo ?? r?.picture ?? null;
  const categoria =
    r?.categoria ?? r?.category ?? r?.section ?? r?.seccion ?? r?.type ?? null;

  const stock =
    typeof r?.stock === "number"
      ? r.stock
      : typeof r?.quantity === "number"
      ? r.quantity
      : typeof r?.qty === "number"
      ? r.qty
      : null;

  const activo =
    typeof r?.activo === "boolean"
      ? r.activo
      : typeof r?.active === "boolean"
      ? r.active
      : typeof r?.is_active === "boolean"
      ? r.is_active
      : true;

  return { id, nombre, precio, descripcion, imagen, categoria, stock, activo };
}

async function fetchProducts(): Promise<Product[]> {
  const url = "/api/products?active=1";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(
      `No se pudieron cargar los productos: HTTP ${res.status} en ${url} ${
        txt ? `(${txt})` : ""
      }`
    );
  }
  const data = await res.json();
  const raw: any[] = Array.isArray(data) ? data : Array.isArray(data?.products) ? data.products : [];
  return raw.map(normalizeProduct);
}

export default function MenuPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("Todas");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await fetchProducts();
        if (!alive) return;
        setProducts(list);
        setErr(null);
      } catch (e: any) {
        setErr(e?.message || "Error al cargar productos");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      const c = (p.categoria || "Sin categoría").trim();
      if (c) set.add(c);
    }
    return ["Todas", ...Array.from(set).sort((a, b) => a.localeCompare(b, "es"))];
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const okCat = category === "Todas" || (p.categoria || "").trim() === category;
      const okName = !q || (p.nombre || "").toLowerCase().includes(q);
      return okCat && okName;
    });
  }, [products, query, category]);

  // === ORDEN PERSONALIZADO DE CATEGORÍAS ===
  // Queremos que "Bebidas" vaya al final y "Postres" justo delante.
  function categoryKey(raw: string) {
    const k = (raw || "").trim().toLowerCase();
    if (k === "bebidas") return { bucket: 2, name: raw };   // último
    if (k === "postres") return { bucket: 1, name: raw };   // penúltimo
    return { bucket: 0, name: raw };                        // resto (alfabético)
  }

  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of filtered) {
      const c = (p.categoria || "Sin categoría").trim();
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(p);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      const ka = categoryKey(a);
      const kb = categoryKey(b);
      if (ka.bucket !== kb.bucket) return ka.bucket - kb.bucket; // 0 antes que 1, antes que 2
      return ka.name.localeCompare(kb.name, "es"); // alfabético dentro de cada bucket
    });
  }, [filtered]);
  // === FIN ORDEN PERSONALIZADO ===

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">Menú</h1>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          placeholder="Buscar por nombre."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm sm:max-w-xl"
        />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm sm:w-48"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {loading && <div className="text-gray-600">Cargando productos…</div>}
      {err && !loading && <div className="text-sm text-red-600">{err}</div>}
      {!loading && !err && grouped.length === 0 && (
        <div className="text-gray-600">No hay productos para mostrar.</div>
      )}

      {!loading &&
        !err &&
        grouped.map(([cat, list]) => (
          <section key={cat} className="mb-10">
            <h2 className="mb-4 text-xl font-semibold">{cat}</h2>

            {/* GRID centrada y compacta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 place-items-center">
              {list.map((p) => {
                const agotado = (p.stock ?? 0) <= 0 || p.activo === false;

                return (
                  <article
                    key={String(p.id)}
                    className="w-full max-w-[19rem] rounded-2xl border bg-white overflow-hidden shadow-sm transition-transform duration-200 ease-out hover:shadow-lg hover:-translate-y-0.5 hover:scale-[1.015]"
                  >
                    {/* Imagen: ocupa todo el ancho/alto (object-cover) */}
                    <div className="relative w-full h-32 bg-gray-100">
                      {p.imagen ? (
                        <img
                          src={p.imagen}
                          alt={p.nombre}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs">
                          Sin imagen
                        </div>
                      )}
                    </div>

                    {/* Contenido centrado */}
                    <div className="p-3 flex-1 flex flex-col items-center text-center">
                      <div className="text-[0.95rem] font-semibold leading-tight">
                        {p.nombre || "(sin nombre)"}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {p.precio.toFixed(2)} €
                      </div>

                      {p.descripcion && (
                        <p className="mt-2 text-xs text-gray-600">
                          {p.descripcion}
                        </p>
                      )}

                      <div className="mt-3 w-full">
                        {agotado ? (
                          <span className="inline-flex w-full items-center justify-center rounded-md bg-gray-200 px-3 py-2 text-xs font-medium text-gray-700">
                            AGOTADO
                          </span>
                        ) : (
                          <AddButtonWithFeedback
                            onAdd={() =>
                              addItem(
                                {
                                  id: p.id,
                                  nombre: p.nombre,
                                  precio: p.precio,
                                  imagen: p.imagen || undefined,
                                },
                                1
                              )
                            }
                            className="w-full !py-2 text-[0.9rem] bg-green-600 hover:bg-green-700"
                            label="Añadir"
                            addedLabel="Añadido"
                          />
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            {/* FIN GRID */}
          </section>
        ))}
    </main>
  );
}
