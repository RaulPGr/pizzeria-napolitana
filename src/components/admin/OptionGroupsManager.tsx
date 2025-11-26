"use client";

import { useEffect, useMemo, useState } from "react";

type OptionGroup = {
  id: string;
  name: string;
  description?: string | null;
  selection_type: "single" | "multiple";
  min_select?: number | null;
  max_select?: number | null;
  is_required?: boolean | null;
  sort_order?: number | null;
};

type OptionItem = {
  id: string;
  group_id: string;
  name: string;
  price_delta?: number | null;
  sort_order?: number | null;
};

type Product = {
  id: number;
  name: string;
  active?: boolean | null;
  category_id?: number | null;
  category_name?: string | null;
};

type Category = {
  id: number;
  name: string;
};

type CategoryAssignment = {
  id: string;
  category_id: number;
  group_id: string;
};

type GroupFormState = {
  name: string;
  description: string;
  selection_type: "single" | "multiple";
  min_select: string;
  max_select: string;
  sort_order: string;
  is_required: boolean;
};

type OptionFormState = {
  name: string;
  price_delta: string;
  sort_order: string;
};

const DEFAULT_GROUP_FORM: GroupFormState = {
  name: "",
  description: "",
  selection_type: "single",
  min_select: "1",
  max_select: "1",
  sort_order: "",
  is_required: true,
};

const DEFAULT_OPTION_FORM: OptionFormState = {
  name: "",
  price_delta: "0",
  sort_order: "",
};

export default function OptionGroupsManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<OptionGroup[]>([]);
  const [options, setOptions] = useState<OptionItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryAssignments, setCategoryAssignments] = useState<CategoryAssignment[]>([]);
  const [groupForm, setGroupForm] = useState<GroupFormState>(DEFAULT_GROUP_FORM);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [optionForm, setOptionForm] = useState<OptionFormState>(DEFAULT_OPTION_FORM);
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | "">("");
  const [bulkGroupId, setBulkGroupId] = useState<string>("");
  const [bulkProductIds, setBulkProductIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const resp = await fetch("/api/admin/product-option-groups", { cache: "no-store" });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo cargar la informacion");
      }
      const incomingGroups: OptionGroup[] = Array.isArray(data.groups) ? data.groups : [];
      setGroups(incomingGroups);
      setOptions(Array.isArray(data.options) ? data.options : []);
      const productList: Product[] = Array.isArray(data.products) ? data.products : [];
      setProducts(productList);
      setBulkProductIds((prev) => prev.filter((id) => productList.some((p) => String(p.id) === id)));
      const categoryList: Category[] = Array.isArray(data.categories)
        ? data.categories.map((cat: any) => ({
            id: Number(cat.id),
            name: cat.name,
          }))
        : [];
      setCategories(categoryList);
      const catAssignments: CategoryAssignment[] = Array.isArray(data.categoryAssignments)
        ? data.categoryAssignments.map((item: any) => ({
            id: String(item.id),
            category_id: Number(item.category_id),
            group_id: item.group_id,
          }))
        : [];
      setCategoryAssignments(catAssignments);
      if (!selectedGroupId && incomingGroups.length) {
        setSelectedGroupId(incomingGroups[0].id);
      } else if (selectedGroupId && !incomingGroups.some((g: OptionGroup) => g.id === selectedGroupId)) {
        setSelectedGroupId(incomingGroups[0]?.id ?? null);
      }
      if (!bulkGroupId && incomingGroups.length) {
        setBulkGroupId(incomingGroups[0].id);
      } else if (bulkGroupId && incomingGroups.length && !incomingGroups.some((g) => g.id === bulkGroupId)) {
        setBulkGroupId(incomingGroups[0]?.id ?? "");
      }
      if (selectedCategoryId === "" && categoryList.length) {
        setSelectedCategoryId(categoryList[0].id);
      } else if (selectedCategoryId !== "" && !categoryList.some((c) => c.id === selectedCategoryId)) {
        setSelectedCategoryId(categoryList[0]?.id ?? "");
      }
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar la informacion");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const optionsByGroup = useMemo(() => {
    const map = new Map<string, OptionItem[]>();
    options.forEach((option) => {
      if (!map.has(option.group_id)) map.set(option.group_id, []);
      map.get(option.group_id)!.push(option);
    });
    map.forEach((list, key) => {
      list.sort((a, b) => {
        const ao = a.sort_order ?? 0;
        const bo = b.sort_order ?? 0;
        if (ao === bo) return a.name.localeCompare(b.name);
        return ao - bo;
      });
    });
    return map;
  }, [options]);

  const categoryAssignmentsByCategory = useMemo(() => {
    const map = new Map<number, Set<string>>();
    categoryAssignments.forEach((assign) => {
      if (!map.has(assign.category_id)) map.set(assign.category_id, new Set());
      map.get(assign.category_id)!.add(assign.group_id);
    });
    return map;
  }, [categoryAssignments]);

  function resetGroupForm() {
    setGroupForm(DEFAULT_GROUP_FORM);
    setEditingGroupId(null);
  }

  function startEditGroup(group: OptionGroup) {
    setEditingGroupId(group.id);
    setSelectedGroupId(group.id);
    setGroupForm({
      name: group.name || "",
      description: group.description || "",
      selection_type: group.selection_type || "single",
      min_select: group.min_select != null ? String(group.min_select) : "",
      max_select: group.max_select != null ? String(group.max_select) : "",
      sort_order: group.sort_order != null ? String(group.sort_order) : "",
      is_required: group.is_required !== false,
    });
  }

  async function saveGroup() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload = {
        ...groupForm,
        min_select: groupForm.min_select.trim() === "" ? null : Number(groupForm.min_select),
        max_select: groupForm.max_select.trim() === "" ? null : Number(groupForm.max_select),
        sort_order: groupForm.sort_order.trim() === "" ? null : Number(groupForm.sort_order),
      };
      const method = editingGroupId ? "PATCH" : "POST";
      const body = editingGroupId ? { id: editingGroupId, ...payload } : payload;
      const resp = await fetch("/api/admin/option-groups", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo guardar el grupo");
      }
      setMessage(editingGroupId ? "Grupo actualizado" : "Grupo creado");
      resetGroupForm();
      await load();
    } catch (e: any) {
      setError(e?.message || "No se pudo guardar el grupo");
    } finally {
      setSaving(false);
    }
  }

  async function removeGroup(id: string) {
    if (!window.confirm("Eliminar este grupo? Se eliminaran tambien sus opciones.")) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const resp = await fetch(`/api/admin/option-groups?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo eliminar el grupo");
      }
      if (editingGroupId === id) resetGroupForm();
      if (selectedGroupId === id) setSelectedGroupId(null);
      setMessage("Grupo eliminado");
      await load();
    } catch (e: any) {
      setError(e?.message || "No se pudo eliminar el grupo");
    } finally {
      setSaving(false);
    }
  }

  function resetOptionForm() {
    setOptionForm(DEFAULT_OPTION_FORM);
    setEditingOptionId(null);
  }

  function startEditOption(option: OptionItem) {
    setEditingOptionId(option.id);
    setSelectedGroupId(option.group_id);
    setOptionForm({
      name: option.name,
      price_delta: option.price_delta != null ? String(option.price_delta) : "0",
      sort_order: option.sort_order != null ? String(option.sort_order) : "",
    });
  }

  async function saveOption() {
    if (!selectedGroupId) {
      setError("Selecciona un grupo para anadir opciones");
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload = {
        ...optionForm,
        group_id: selectedGroupId,
        price_delta: optionForm.price_delta.trim() === "" ? 0 : Number(optionForm.price_delta),
        sort_order: optionForm.sort_order.trim() === "" ? null : Number(optionForm.sort_order),
      };
      const method = editingOptionId ? "PATCH" : "POST";
      const body = editingOptionId ? { id: editingOptionId, ...payload } : payload;
      const resp = await fetch("/api/admin/options", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo guardar la opcion");
      }
      setMessage(editingOptionId ? "Opcion actualizada" : "Opcion creada");
      resetOptionForm();
      await load();
    } catch (e: any) {
      setError(e?.message || "No se pudo guardar la opcion");
    } finally {
      setSaving(false);
    }
  }

  async function removeOption(id: string) {
    if (!window.confirm("Eliminar esta opcion?")) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const resp = await fetch(`/api/admin/options?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo eliminar la opcion");
      }
      if (editingOptionId === id) resetOptionForm();
      setMessage("Opcion eliminada");
      await load();
    } catch (e: any) {
      setError(e?.message || "No se pudo eliminar la opcion");
    } finally {
      setSaving(false);
    }
  }

  async function toggleCategoryAssignment(groupId: string) {
    if (selectedCategoryId === "") {
      setError("Selecciona una categoria");
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const assignedIds = categoryAssignmentsByCategory.get(Number(selectedCategoryId));
      const alreadyAssigned = assignedIds?.has(groupId);
      if (alreadyAssigned) {
        const url = `/api/admin/category-option-groups?category_id=${selectedCategoryId}&group_id=${encodeURIComponent(
          groupId
        )}`;
        const resp = await fetch(url, { method: "DELETE" });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data?.ok) {
          throw new Error(data?.error || "No se pudo desasignar el grupo de la categoria");
        }
      } else {
        const resp = await fetch("/api/admin/category-option-groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ group_id: groupId, category_id: selectedCategoryId }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data?.ok) {
          throw new Error(data?.error || "No se pudo asignar el grupo a la categoria");
        }
      }
      await load();
    } catch (e: any) {
      setError(e?.message || "No se pudo actualizar la categoria");
    } finally {
      setSaving(false);
    }
  }

  async function applyBulkToProducts(action: "assign" | "remove") {
    if (!bulkGroupId) {
      setError("Selecciona un grupo para la asignacion masiva");
      return;
    }
    if (bulkProductIds.length === 0) {
      setError("Selecciona al menos un producto en la lista");
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      for (const id of bulkProductIds) {
        const productId = Number(id);
        if (!Number.isFinite(productId)) continue;
        if (action === "assign") {
          const resp = await fetch("/api/admin/product-option-groups", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ group_id: bulkGroupId, product_id: productId }),
          });
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok || !data?.ok) {
            throw new Error(data?.error || "No se pudo asignar el grupo a todos los productos");
          }
        } else {
          const url = `/api/admin/product-option-groups?product_id=${productId}&group_id=${encodeURIComponent(
            bulkGroupId
          )}`;
          const resp = await fetch(url, { method: "DELETE" });
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok || !data?.ok) {
            throw new Error(data?.error || "No se pudo quitar el grupo en algun producto");
          }
        }
      }
      setMessage(
        action === "assign"
          ? "Grupo asignado a los productos seleccionados"
          : "Grupo quitado de los productos seleccionados"
      );
      await load();
    } catch (e: any) {
      setError(e?.message || "No se pudo actualizar la seleccion masiva");
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || null;
  const currentOptions = selectedGroupId ? optionsByGroup.get(selectedGroupId) || [] : [];
  const assignedCategoryGroups = useMemo(() => {
    if (selectedCategoryId === "") return new Set<string>();
    return categoryAssignmentsByCategory.get(Number(selectedCategoryId)) ?? new Set<string>();
  }, [categoryAssignmentsByCategory, selectedCategoryId]);

  return (
    <div className="space-y-6">
      <section className="rounded border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Toppings y extras reutilizables</h2>
        <p className="mt-1 text-sm text-slate-600">
          Crea grupos de opciones (por ejemplo "Topping 1 (salsa)" o "Extras") y asignalos a varios productos. Cada grupo puede exigir
          una seleccion concreta (unica u multiple) y mostrar un texto explicativo al cliente antes de anadir su pedido.
        </p>
      </section>

      <section className="rounded border bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold">Asignar grupos a categorias</h3>
        {categories.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Todavia no hay categorias configuradas.</p>
        ) : groups.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Crea al menos un grupo antes de asignarlo a una categoria.</p>
        ) : (
          <div className="mt-3 space-y-4">
            <label className="text-sm">
              <span className="text-slate-600">Categoria</span>
              <select
                className="mt-1 w-full rounded border px-3 py-2 bg-white"
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : "")}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="space-y-2 rounded border px-4 py-3">
              {groups.map((group) => {
                const assigned = assignedCategoryGroups.has(group.id);
                return (
                  <label key={group.id} className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium">{group.name}</p>
                      <p className="text-xs text-slate-500">
                        {group.selection_type === "multiple" ? "Varias selecciones" : "Una seleccion"}
                        {" - "}
                        {group.is_required === false ? "Opcional" : "Obligatorio"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void toggleCategoryAssignment(group.id)}
                      className={`rounded-full border px-3 py-1 text-xs ${assigned ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}
                    >
                      {assigned ? "Asignado" : "Asignar"}
                    </button>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="rounded border bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold">Asignacion masiva de productos</h3>
        {products.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Necesitas productos en el catalogo para usar esta opcion.</p>
        ) : groups.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Crea un grupo antes de realizar asignaciones masivas.</p>
        ) : (
          <div className="mt-3 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm">
                <span className="text-slate-600">Productos (usa Ctrl o Cmd para seleccionar varios)</span>
                <select
                  multiple
                  size={8}
                  className="mt-1 w-full rounded border px-3 py-2 bg-white"
                  value={bulkProductIds}
                  onChange={(e) =>
                    setBulkProductIds(Array.from(e.currentTarget.selectedOptions).map((opt) => opt.value))
                  }
                >
                  {products.map((product) => (
                    <option key={product.id} value={String(product.id)}>
                      {product.name}
                      {product.category_name ? ` - ${product.category_name}` : ""}
                      {product.active === false ? " (inactivo)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="text-slate-600">Grupo a aplicar</span>
                <select
                  className="mt-1 w-full rounded border px-3 py-2 bg-white"
                  value={bulkGroupId}
                  onChange={(e) => setBulkGroupId(e.target.value)}
                >
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-60"
                onClick={() => void applyBulkToProducts("assign")}
                disabled={saving}
              >
                Asignar seleccion
              </button>
              <button
                type="button"
                className="rounded border border-rose-200 bg-rose-50 px-4 py-2 text-rose-700 disabled:opacity-60"
                onClick={() => void applyBulkToProducts("remove")}
                disabled={saving}
              >
                Quitar del grupo
              </button>
              <p className="text-xs text-slate-500">
                Esta accion aplica el mismo grupo a todos los productos elegidos o lo elimina de ellos.
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="rounded border bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold">{editingGroupId ? "Editar grupo" : "Crear nuevo grupo"}</h3>
          {editingGroupId && (
            <button
              type="button"
              className="text-sm text-blue-600 hover:underline"
              onClick={resetGroupForm}
            >
              Cancelar edicion
            </button>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            <span className="text-slate-600">Nombre</span>
            <input
              type="text"
              className="mt-1 w-full rounded border px-3 py-2"
              value={groupForm.name}
              onChange={(e) => setGroupForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Topping 1 (salsa)"
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Descripcion para el cliente</span>
            <input
              type="text"
              className="mt-1 w-full rounded border px-3 py-2"
              value={groupForm.description}
              onChange={(e) => setGroupForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Elige tu salsa favorita"
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Tipo de seleccion</span>
            <select
              className="mt-1 w-full rounded border px-3 py-2 bg-white"
              value={groupForm.selection_type}
              onChange={(e) =>
                setGroupForm((prev) => ({
                  ...prev,
                  selection_type: e.target.value as "single" | "multiple",
                }))
              }
            >
              <option value="single">Seleccion unica (radio)</option>
              <option value="multiple">Varias opciones (checkbox)</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Orden (opcional)</span>
            <input
              type="number"
              className="mt-1 w-full rounded border px-3 py-2"
              value={groupForm.sort_order}
              onChange={(e) => setGroupForm((prev) => ({ ...prev, sort_order: e.target.value }))}
              placeholder="Ej: 10"
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Minimo a seleccionar</span>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded border px-3 py-2"
              value={groupForm.min_select}
              onChange={(e) => setGroupForm((prev) => ({ ...prev, min_select: e.target.value }))}
              placeholder="0"
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Maximo a seleccionar</span>
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded border px-3 py-2"
              value={groupForm.max_select}
              onChange={(e) => setGroupForm((prev) => ({ ...prev, max_select: e.target.value }))}
              placeholder="Sin limite"
            />
          </label>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={groupForm.is_required}
              onChange={(e) => setGroupForm((prev) => ({ ...prev, is_required: e.target.checked }))}
            />
            Este grupo es obligatorio para anadir el producto al carrito.
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-60"
            onClick={() => void saveGroup()}
            disabled={saving || !groupForm.name.trim()}
          >
            {saving ? "Guardando..." : editingGroupId ? "Actualizar grupo" : "Crear grupo"}
          </button>
          <button type="button" className="rounded border px-4 py-2 text-sm" onClick={resetGroupForm} disabled={saving}>
            Limpiar
          </button>
          {message && <span className="text-sm text-emerald-700">{message}</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </section>

      <section className="rounded border bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold">Grupos configurados</h3>
        {loading ? (
          <p className="mt-2 text-sm text-slate-500">Cargando grupos...</p>
        ) : groups.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Todavia no hay grupos creados.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {groups.map((group) => {
              const count = optionsByGroup.get(group.id)?.length ?? 0;
              return (
                <div
                  key={group.id}
                  className={`rounded border px-4 py-3 ${
                    selectedGroupId === group.id ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{group.name}</p>
                      {group.description && <p className="text-xs text-slate-500">{group.description}</p>}
                    </div>
                    <span className="text-xs text-slate-500">{count} opciones</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                    <span>
                      Tipo: {group.selection_type === "multiple" ? "Varias opciones" : "Una opcion"}
                    </span>
                    <span>
                      Requisito: {group.is_required === false ? "Opcional" : "Obligatorio"}
                    </span>
                    <span>
                      Min {group.min_select ?? 0} / Max {group.max_select ?? "sin limite"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      className="text-xs text-blue-600 hover:underline"
                      type="button"
                      onClick={() => setSelectedGroupId(group.id)}
                    >
                      Gestionar opciones
                    </button>
                    <button
                      className="text-xs text-slate-600 hover:underline"
                      type="button"
                      onClick={() => startEditGroup(group)}
                    >
                      Editar
                    </button>
                    <button
                      className="text-xs text-red-600 hover:underline"
                      type="button"
                      onClick={() => void removeGroup(group.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold">Opciones dentro del grupo</h3>
          {selectedGroup && (
            <span className="text-sm text-slate-500">
              Gestionando: <strong>{selectedGroup.name}</strong>
            </span>
          )}
        </div>
        {!selectedGroup ? (
          <p className="mt-2 text-sm text-slate-500">
            Selecciona un grupo para anadir sus opciones (por ejemplo sabores o toppings disponibles).
          </p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="text-sm font-semibold">Opciones disponibles</h4>
              {currentOptions.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Todavia no hay opciones en este grupo.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {currentOptions.map((option) => (
                    <li key={option.id} className="rounded border px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{option.name}</p>
                          <p className="text-xs text-slate-500">
                            {option.price_delta ? `+${option.price_delta.toFixed(2)} EUR` : "Sin recargo"}
                            {option.sort_order != null ? ` - Orden ${option.sort_order}` : ""}
                          </p>
                        </div>
                        <div className="flex gap-2 text-xs">
                          <button className="text-blue-600 hover:underline" type="button" onClick={() => startEditOption(option)}>
                            Editar
                          </button>
                          <button className="text-red-600 hover:underline" type="button" onClick={() => void removeOption(option.id)}>
                            Quitar
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4 className="text-sm font-semibold">{editingOptionId ? "Editar opcion" : "Nueva opcion"}</h4>
              <div className="mt-2 space-y-3">
                <label className="text-sm">
                  <span className="text-slate-600">Nombre</span>
                  <input
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={optionForm.name}
                    onChange={(e) => setOptionForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Chocolate blanco"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">Recargo (EUR)</span>
                  <input
                    type="number"
                    step="0.1"
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={optionForm.price_delta}
                    onChange={(e) => setOptionForm((prev) => ({ ...prev, price_delta: e.target.value }))}
                    placeholder="0"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">Orden</span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={optionForm.sort_order}
                    onChange={(e) => setOptionForm((prev) => ({ ...prev, sort_order: e.target.value }))}
                    placeholder="Ej: 10"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-60"
                    onClick={() => void saveOption()}
                    disabled={saving || !optionForm.name.trim()}
                  >
                    {saving ? "Guardando..." : editingOptionId ? "Actualizar opcion" : "Anadir opcion"}
                  </button>
                  {editingOptionId && (
                    <button type="button" className="text-sm text-slate-600 hover:underline" onClick={resetOptionForm}>
                      Cancelar edicion
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

    </div>
  );
}




