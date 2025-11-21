"use client";

import { useEffect, useMemo, useState } from "react";

type Promotion = {
  id: string;
  name: string;
  description?: string | null;
  type: "percent" | "fixed";
  value: number;
  scope: "order" | "category" | "product";
  target_category_id?: number | null;
  target_product_id?: number | null;
  target_product_ids?: number[] | null;
  min_amount?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  weekdays?: number[] | null;
  active?: boolean;
};

type Option = { id: number; name: string; active?: boolean };

const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
const WEEKDAY_LABELS: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
  7: "Domingo",
};

type FormState = {
  name: string;
  description: string;
  type: "percent" | "fixed";
  value: string;
  scope: "order" | "category" | "product";
  target_category_id: string;
  target_product_ids: string[];
  min_amount: string;
  start_date: string;
  end_date: string;
  weekdays: number[];
  active: boolean;
};

const DEFAULT_FORM: FormState = {
  name: "",
  description: "",
  type: "percent",
  value: "10",
  scope: "order",
  target_category_id: "",
  target_product_ids: [],
  min_amount: "",
  start_date: "",
  end_date: "",
  weekdays: [...ALL_WEEKDAYS],
  active: true,
};

function formatDateLabel(value?: string | null) {
  if (!value) return "-";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
  } catch {
    return value;
  }
}

function formatScope(promo: Promotion, categories: Option[], products: Option[]) {
  if (promo.scope === "order") return "Pedido completo";
  if (promo.scope === "category") {
    const name = categories.find((c) => c.id === promo.target_category_id)?.name;
    return name ? `Categoría: ${name}` : "Categoría";
  }
  if (promo.scope === "product") {
    const ids = (promo.target_product_ids && promo.target_product_ids.length > 0)
      ? promo.target_product_ids
      : (promo.target_product_id ? [promo.target_product_id] : []);
    if (!ids.length) return "Producto";
    const names = ids
      .map((id) => products.find((p) => p.id === id)?.name)
      .filter(Boolean) as string[];
    if (names.length === 0) return "Producto";
    return `Productos: ${names.join(", ")}`;
  }
  return promo.scope;
}

export default function PromotionsManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [list, setList] = useState<Promotion[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [products, setProducts] = useState<Option[]>([]);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/admin/promotions", { cache: "no-store" });
      const j = await resp.json();
      if (!resp.ok || !j?.ok) throw new Error(j?.error || "No se pudieron cargar las promociones");
      setList(Array.isArray(j.promotions) ? j.promotions : []);
      setCategories(Array.isArray(j.categories) ? j.categories : []);
      setProducts(Array.isArray(j.products) ? j.products : []);
    } catch (e: any) {
      setError(e?.message || "No se pudieron cargar las promociones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function resetForm() {
    setForm(DEFAULT_FORM);
    setEditingId(null);
  }

function startEdit(promo: Promotion) {
  setEditingId(promo.id);
  setForm({
    name: promo.name || "",
    description: promo.description || "",
    type: promo.type,
    value: String(promo.value ?? ""),
    scope: promo.scope,
    target_category_id: promo.target_category_id ? String(promo.target_category_id) : "",
    target_product_ids: promo.target_product_ids && promo.target_product_ids.length > 0
      ? promo.target_product_ids.map((id) => String(id))
      : (promo.target_product_id ? [String(promo.target_product_id)] : []),
      min_amount: promo.min_amount != null ? String(promo.min_amount) : "",
      start_date: promo.start_date || "",
      end_date: promo.end_date || "",
      weekdays: promo.weekdays && promo.weekdays.length > 0 ? promo.weekdays : [...ALL_WEEKDAYS],
      active: promo.active !== false,
    });
  }

  function toggleWeekday(day: number) {
    setForm((prev) => {
      const exists = prev.weekdays.includes(day);
      const next = exists ? prev.weekdays.filter((d) => d !== day) : [...prev.weekdays, day];
      return { ...prev, weekdays: next.length > 0 ? next.sort((a, b) => a - b) : [] };
    });
  }

  function toggleProductSelection(id: string) {
    setForm((prev) => {
      const exists = prev.target_product_ids.includes(id);
      return {
        ...prev,
        target_product_ids: exists
          ? prev.target_product_ids.filter((val) => val !== id)
          : [...prev.target_product_ids, id],
      };
    });
  }

  async function save() {
    try {
      setSaving(true);
      setMessage(null);
      setError(null);
    const payload = {
        ...form,
        value: Number(form.value),
        min_amount: form.min_amount ? Number(form.min_amount) : undefined,
        weekdays: form.weekdays.length > 0 ? form.weekdays : [...ALL_WEEKDAYS],
        target_category_id: form.scope === "category" ? Number(form.target_category_id) || null : null,
        target_product_id:
          form.scope === "product" && form.target_product_ids.length > 0
            ? Number(form.target_product_ids[0]) || null
            : null,
        target_product_ids:
          form.scope === "product"
            ? form.target_product_ids
                .map((id) => Number(id))
                .filter((id) => Number.isFinite(id))
            : null,
      };
      const method = editingId ? "PATCH" : "POST";
      const body = editingId ? { id: editingId, ...payload } : payload;
      const resp = await fetch("/api/admin/promotions", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok || !j?.ok) throw new Error(j?.error || "No se pudo guardar");
      setMessage(editingId ? "Promoción actualizada" : "Promoción creada");
      resetForm();
      await load();
    } catch (e: any) {
      setError(e?.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("¿Eliminar esta promoción?")) return;
    try {
      setSaving(true);
      setMessage(null);
      setError(null);
      const resp = await fetch(`/api/admin/promotions?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok || !j?.ok) throw new Error(j?.error || "No se pudo eliminar");
      setMessage("Promoción eliminada");
      await load();
    } catch (e: any) {
      setError(e?.message || "No se pudo eliminar");
    } finally {
      setSaving(false);
    }
  }

  const weekdaysPreview = useMemo(() => {
    if (form.weekdays.length === 7) return "Todos los días";
    return form.weekdays.map((d) => WEEKDAY_LABELS[d] || d).join(", ") || "Sin días";
  }, [form.weekdays]);

  return (
    <div className="space-y-6">
      <section className="rounded border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Promociones</h2>
        <p className="text-sm text-slate-600">
          Usa esta sección para crear descuentos automáticos. Una promoción puede aplicarse al pedido completo, a una categoría concreta o solo a un producto.
          Define fechas, días válidos y un importe mínimo para controlar cuándo se activa.
        </p>
      </section>

      <section className="rounded border bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">{editingId ? "Editar promoción" : "Crear nueva promoción"}</h3>
          {editingId && (
            <button className="text-sm text-blue-600 hover:underline" onClick={resetForm} type="button">
              Cancelar edición
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm">
            <span className="text-slate-600">Nombre</span>
            <input className="mt-1 w-full rounded border px-3 py-2" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Promo lunes locos" />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Descripción (opcional)</span>
            <input className="mt-1 w-full rounded border px-3 py-2" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Descuento para pedidos grandes" />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Tipo de descuento</span>
            <select className="mt-1 w-full rounded border px-3 py-2" value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as any }))}>
              <option value="percent">% sobre el importe</option>
              <option value="fixed">Importe fijo (€)</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Valor</span>
            <input type="number" min="0" step="0.01" className="mt-1 w-full rounded border px-3 py-2" value={form.value} onChange={(e) => setForm((prev) => ({ ...prev, value: e.target.value }))} placeholder={form.type === "percent" ? "Ej: 10 (10%)" : "Ej: 3 (3€)"} />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Ámbito</span>
            <select className="mt-1 w-full rounded border px-3 py-2" value={form.scope} onChange={(e) => setForm((prev) => ({ ...prev, scope: e.target.value as any }))}>
              <option value="order">Pedido completo</option>
              <option value="category">Categoría</option>
              <option value="product">Producto</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Importe mínimo (€)</span>
            <input type="number" min="0" step="0.5" className="mt-1 w-full rounded border px-3 py-2" value={form.min_amount} onChange={(e) => setForm((prev) => ({ ...prev, min_amount: e.target.value }))} placeholder="Opcional" />
          </label>
          {form.scope === "category" && (
            <label className="text-sm">
              <span className="text-slate-600">Categoría objetivo</span>
              <select className="mt-1 w-full rounded border px-3 py-2 bg-white" value={form.target_category_id} onChange={(e) => setForm((prev) => ({ ...prev, target_category_id: e.target.value }))}>
                <option value="">Selecciona categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {form.scope === "product" && (
            <div className="text-sm">
              <span className="text-slate-600">Productos objetivo</span>
              <div className="mt-2 max-h-56 overflow-y-auto rounded border bg-white px-3 py-2 shadow-inner">
                {products.length === 0 ? (
                  <p className="text-xs text-slate-500">Aún no hay productos disponibles.</p>
                ) : (
                  products.map((p) => {
                    const value = String(p.id);
                    const checked = form.target_product_ids.includes(value);
                    return (
                      <label key={p.id} className="flex items-center gap-2 py-1 text-slate-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleProductSelection(value)}
                        />
                        <span>
                          {p.name}
                          {p.active === false ? " (inactivo)" : ""}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {form.target_product_ids.length === 0
                  ? "Selecciona al menos un producto."
                  : `${form.target_product_ids.length} producto(s) seleccionado(s).`}
              </p>
            </div>
          )}
          <label className="text-sm">
            <span className="text-slate-600">Fecha inicio</span>
            <input type="date" className="mt-1 w-full rounded border px-3 py-2" value={form.start_date} onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))} />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Fecha fin</span>
            <input type="date" className="mt-1 w-full rounded border px-3 py-2" value={form.end_date} onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))} />
          </label>
          <div className="text-sm md:col-span-2">
            <span className="text-slate-600">Días aplicables</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {ALL_WEEKDAYS.map((day) => (
                <button
                  type="button"
                  key={day}
                  onClick={() => toggleWeekday(day)}
                  className={`rounded border px-3 py-1 text-xs ${form.weekdays.includes(day) ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}
                >
                  {WEEKDAY_LABELS[day].slice(0, 3)}
                </button>
              ))}
              <button type="button" onClick={() => setForm((prev) => ({ ...prev, weekdays: [...ALL_WEEKDAYS] }))} className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-600">
                Todos
              </button>
            </div>
            <div className="mt-1 text-xs text-slate-500">{weekdaysPreview}</div>
          </div>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))} />
            Promoción activa
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={() => void save()} disabled={saving || !form.name.trim()} className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-60" type="button">
            {saving ? "Guardando..." : editingId ? "Actualizar promoción" : "Crear promoción"}
          </button>
          {!saving && (
            <button type="button" onClick={resetForm} className="rounded border px-4 py-2 text-sm">
              Limpiar
            </button>
          )}
          {message && <span className="text-sm text-emerald-700">{message}</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </section>

      <section className="rounded border bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-base font-semibold">Promociones existentes</h3>
        {loading ? (
          <div className="text-sm text-slate-500">Cargando...</div>
        ) : list.length === 0 ? (
          <div className="text-sm text-slate-500">Todavía no hay promociones.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="border-b px-3 py-2">Nombre</th>
                  <th className="border-b px-3 py-2">Tipo</th>
                  <th className="border-b px-3 py-2">Ámbito</th>
                  <th className="border-b px-3 py-2">Vigencia</th>
                  <th className="border-b px-3 py-2">Días</th>
                  <th className="border-b px-3 py-2">Estado</th>
                  <th className="border-b px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {list.map((promo) => {
                  const valueLabel = promo.type === "percent" ? `${promo.value}%` : `${Number(promo.value || 0).toFixed(2)} €`;
                  const scopeLabel = formatScope(promo, categories, products);
                  const days = promo.weekdays && promo.weekdays.length > 0 ? promo.weekdays.map((d) => WEEKDAY_LABELS[d]?.slice(0, 3) || d).join(", ") : "Todos";
                  return (
                    <tr key={promo.id} className="hover:bg-slate-50">
                      <td className="border-b px-3 py-2">
                        <div className="font-medium">{promo.name}</div>
                        {promo.description && <div className="text-xs text-slate-500">{promo.description}</div>}
                      </td>
                      <td className="border-b px-3 py-2">{valueLabel}</td>
                      <td className="border-b px-3 py-2">{scopeLabel}</td>
                      <td className="border-b px-3 py-2 text-xs">
                        {formatDateLabel(promo.start_date)} - {formatDateLabel(promo.end_date)}
                      </td>
                      <td className="border-b px-3 py-2 text-xs">{days}</td>
                      <td className="border-b px-3 py-2">
                        {promo.active === false ? (
                          <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600">Inactiva</span>
                        ) : (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">Activa</span>
                        )}
                      </td>
                      <td className="border-b px-3 py-2 text-right space-x-2">
                        <button className="text-xs text-blue-600 hover:underline" onClick={() => startEdit(promo)} type="button">
                          Editar
                        </button>
                        <button className="text-xs text-red-600 hover:underline" onClick={() => void remove(promo.id)} type="button">
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
