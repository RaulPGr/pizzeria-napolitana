// src/app/promociones/page.tsx
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenant } from "@/lib/tenant";
import { isPromotionActive, type Promotion as PromotionRule } from "@/lib/promotions";

export const dynamic = "force-dynamic";

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 7] as const;
const DAY_LABEL: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
  7: "Domingo",
};

function normalizeWeekdays(promo: PromotionRule): number[] {
  if (Array.isArray(promo.weekdays) && promo.weekdays.length > 0) {
    return promo.weekdays.map((d) => Number(d)).filter((d) => Number.isFinite(d));
  }
  return [...DAY_ORDER];
}

function formatDiscountValue(promo: PromotionRule) {
  if (promo.type === "percent") {
    return `${promo.value}% menos`;
  }
  const value = Number(promo.value || 0);
  return `${value.toFixed(2)} € de descuento`;
}

function formatDateRange(promo: PromotionRule) {
  const start = promo.start_date ? new Date(promo.start_date) : null;
  const end = promo.end_date ? new Date(promo.end_date) : null;
  if (!start && !end) return "Sin fecha límite";
  const fmt = (d: Date) => d.toLocaleDateString("es-ES");
  if (start && end) return `Del ${fmt(start)} al ${fmt(end)}`;
  if (start) return `Desde ${fmt(start)}`;
  return `Hasta ${fmt(end!)}`;
}

function weekdaysLabel(promo: PromotionRule) {
  const days = normalizeWeekdays(promo);
  if (days.length === 7) return "Todos los días";
  return days.map((d) => DAY_LABEL[d] || d).join(", ");
}

function scopeLabel(
  promo: PromotionRule,
  categories: Map<number, string>,
  products: Map<number, string>
) {
  if (promo.scope === "order") return "Pedido completo";
  if (promo.scope === "category") {
    const name = promo.target_category_id ? categories.get(Number(promo.target_category_id)) : null;
    return name ? `Categoría: ${name}` : "Categoría específica";
  }
  if (promo.scope === "product") {
    const ids =
      promo.target_product_ids && promo.target_product_ids.length > 0
        ? promo.target_product_ids
        : promo.target_product_id
        ? [promo.target_product_id]
        : [];
    if (!ids.length) return "Producto específico";
    const names = ids
      .map((id) => products.get(Number(id)))
      .filter(Boolean) as string[];
    return names.length ? `Productos: ${names.join(", ")}` : "Producto específico";
  }
  return "Promoción";
}

function PromoCard({
  promo,
  categories,
  products,
}: {
  promo: PromotionRule;
  categories: Map<number, string>;
  products: Map<number, string>;
}) {
  return (
    <article className="rounded-2xl border border-brand-crust bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-slate-900">{promo.name}</h3>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
          {formatDiscountValue(promo)}
        </span>
      </div>
      {promo.description && <p className="mt-2 text-sm text-slate-600">{promo.description}</p>}
      <div className="mt-4 space-y-1 text-sm text-slate-600">
        <p>
          <strong>Ámbito:</strong> {scopeLabel(promo, categories, products)}
        </p>
        <p>
          <strong>Días:</strong> {weekdaysLabel(promo)}
        </p>
        <p>
          <strong>Vigencia:</strong> {formatDateRange(promo)}
        </p>
        {promo.min_amount ? (
          <p>
            <strong>Pedido mínimo:</strong> {promo.min_amount.toFixed(2)} €
          </p>
        ) : null}
      </div>
    </article>
  );
}

export default async function PromotionsPage() {
  const tenant = await getTenant(null);
  const businessName = (tenant as any)?.name || "nuestro negocio";
  const businessId = (tenant as any)?.id as string | undefined;

  let promotions: PromotionRule[] = [];
  let categoriesMap = new Map<number, string>();
  let productsMap = new Map<number, string>();

  if (businessId) {
    const [promosRes, categoriesRes, productsRes] = await Promise.all([
      supabaseAdmin
        .from("promotions")
        .select("*")
        .eq("business_id", businessId)
        .eq("active", true)
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("categories").select("id, name").eq("business_id", businessId),
      supabaseAdmin.from("products").select("id, name").eq("business_id", businessId),
    ]);
    if (Array.isArray(promosRes.data)) promotions = promosRes.data as PromotionRule[];
    if (Array.isArray(categoriesRes.data)) {
      categoriesMap = new Map(categoriesRes.data.map((c: any) => [Number(c.id), String(c.name)]));
    }
    if (Array.isArray(productsRes.data)) {
      productsMap = new Map(productsRes.data.map((p: any) => [Number(p.id), String(p.name)]));
    }
  }

  const filteredPromos = promotions.filter((p) => p.active !== false);
  const now = new Date();
  const promosToday = filteredPromos.filter((p) => isPromotionActive(p, now));
  const promosByDay = DAY_ORDER.map((day) => {
    const items = filteredPromos.filter((promo) => normalizeWeekdays(promo).includes(day));
    return { day, label: DAY_LABEL[day], promos: items };
  });

  return (
    <main className="min-h-screen bg-brand-chalk text-gray-900 pb-12">
      <section className="border-b border-white/60 bg-white/80">
        <div className="mx-auto max-w-6xl px-4 py-10 text-center md:text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Ofertas especiales</p>
          <h1 className="mt-2 text-3xl font-semibold">
            Promociones activas en {businessName}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Aprovecha nuestras ofertas por tiempo limitado. Encuentra descuentos por categoría, producto o días específicos.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <section className="rounded-2xl border border-brand-crust bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Promociones de hoy</h2>
            <span className="text-sm text-slate-500">
              {promosToday.length} {promosToday.length === 1 ? "promoción activa" : "promociones activas"}
            </span>
          </div>
          {promosToday.length === 0 ? (
            <p className="text-sm text-slate-600">No hay promociones activas en este momento.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {promosToday.map((promo) => (
                <PromoCard key={promo.id} promo={promo} categories={categoriesMap} products={productsMap} />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-brand-crust bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Promociones por día</h2>
          <div className="space-y-6">
            {promosByDay.map(({ day, label, promos }) => (
              <div key={day}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-800">{label}</h3>
                  <span className="text-xs text-slate-500">
                    {promos.length} {promos.length === 1 ? "promoción" : "promociones"}
                  </span>
                </div>
                {promos.length === 0 ? (
                  <p className="rounded-2xl border border-amber-200 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-sm">
                    No hay promociones activas para este día. Vuelve a mirar pronto o consulta los otros días disponibles.
                  </p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {promos.map((promo) => (
                      <PromoCard key={`${promo.id}-${day}`} promo={promo} categories={categoriesMap} products={productsMap} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <div className="text-center">
          <Link
            href="/menu"
            className="inline-flex items-center rounded-full bg-emerald-600 px-6 py-3 text-white shadow hover:bg-emerald-700"
          >
            Ver carta
          </Link>
        </div>
      </div>
    </main>
  );
}
