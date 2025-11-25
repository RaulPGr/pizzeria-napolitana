"use client";

import { useEffect, useMemo, useState } from "react";

type OptionGroup = {
  id: string;
  name: string;
  description?: string | null;
  selection_type: "single" | "multiple";
  min_select: number;
  max_select?: number | null;
  is_required: boolean;
  options_count?: number;
};

type OptionItem = {
  id: string;
  name: string;
  price_delta: number;
  sort_order: number;
};

type GroupFormState = {
  id?: string;
  name: string;
  description: string;
  selection_type: "single" | "multiple";
  min_select: string;
  max_select: string;
  is_required: boolean;
};

const DEFAULT_GROUP_FORM: GroupFormState = {
  name: "",
  description: "",
  selection_type: "single",
  min_select: "0",
  max_select: "",
  is_required: false,
};

export default function OptionGroupsManager() {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<OptionGroup[]>([]);
  const [optionsMap, setOptionsMap] = useState<Record<string, OptionItem[]>>({});
  const [groupForm, setGroupForm] = useState<GroupFormState>(DEFAULT_GROUP_FORM);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const [optionForm, setOptionForm] = useState<{ id?: string; name: string; price_delta: string; sort_order: string }>({
    name: "",
    price_delta: "0",
    sort_order: "0",
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/admin/option-groups", { cache: "no-store" });
      const j = await resp.json();
      if (!resp.ok || !j?.ok) throw new Error(j?.error || "No se pudieron cargar los grupos");
      setGroups(Array.isArray(j.groups) ? j.groups : []);
      setOptionsMap(j.options || {});
      if (!selectedGroupId && Array.isArray(j.groups) && j.groups.length > 0) {
        setSelectedGroupId(j.groups[0].id);
      }
    } catch (e: any) {
      setError(e?.message || "No se pudieron cargar los grupos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function resetGroupForm() {
    setGroupForm(DEFAULT_GROUP_FORM);
    setEditingGroupId(null);
  }

  function startEditGroup(group: OptionGroup) {
    setEditingGroupId(group.id);
    setGroupForm({
      id: group.id,
      name: group.name,
      description: group.description || "",
      selection_type: group.selection_type,
      min_select: String(group.min_select ?? 0),
      max_select: group.max_select != null ? String(group.max_select) : "",
      is_required: group.is_required,
    });
  }

  async function saveGroup() {
    try {
      setMessage(null);
      setError(null);
      const payload = {
        ...groupForm,
        min_select: Number(groupForm.min_select || 0),
        max_select: groupForm.max_select ? Number(groupForm.max_select) : undefined,
      };
      if (!payload.name.trim()) {
        setError("El nombre es obligatorio");
        return;
      }
      const method = editingGroupId ? "PATCH" : "POST";
      const body = editingGroupId ? { ...payload, id: editingGroupId } : payload;
      const resp = await fetch("/api/admin/option-groups", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok || !j?.ok) throw new Error(j?.error || "No se pudo guardar");
      setMessage(editingGroupId ? "Grupo actualizado" : "Grupo creado");
      resetGroupForm();
      await load();
    } catch (e: any) {
      setError(e?.message || "No se pudo guardar");
    }
  }

  async function removeGroup(id: string) {
    if (!window.confirm("¿Eliminar este grupo y sus opciones?")) return;
    try {
      setMessage(null);
      setError(null);
      const resp = await fetch(/api/admin/option-groups?id=, { method: "DELETE" });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok || !j?.ok) throw new Error(j?.error || "No se pudo eliminar");
      if (selectedGroupId === id) setSelectedGroupId(null);
      await load();
    } catch (e: any) {
      setError(e?.message || "No se pudo eliminar");
    }
  }

  const selectedOptions = useMemo(() => {
    if (!selectedGroupId) return [];
    return optionsMap[selectedGroupId] || [];
  }, [selectedGroupId, optionsMap]);

  function resetOptionForm() {
    setOptionForm({ name: "", price_delta: "0", sort_order: "0" });
  }

  function startEditOption(option: OptionItem) {
    setOptionForm({
      id: option.id,
      name: option.name,
      price_delta: String(option.price_delta ?? 0),
      sort_order: String(option.sort_order ?? 0),
    });
  }

  async function saveOption() {
    if (!selectedGroupId) {
      setError("Selecciona un grupo para añadir opciones");
      return;
    }
    try {
      setError(null);
      setMessage(null);
      const payload = {
        group_id: selectedGroupId,
        name: optionForm.name,
        price_delta: Number(optionForm.price_delta || 0),
        sort_order: Number(optionForm.sort_order || 0),
      };
      if (!payload.name.trim()) {
        setError("El nombre de la opción es obligatorio");
        return;
      }
      const method = optionForm.id ? "PATCH" : "POST";
      const body = optionForm.id ? { ...payload, id: optionForm.id } : payload;
      const resp = await fetch("/api/admin/options", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok || !j?.ok) throw new Error(j?.error || "No se pudo guardar la opción");
      setMessage(optionForm.id ? "Opción actualizada" : "Opción creada");
      resetOptionForm();
      await load();
      setSelectedGroupId(selectedGroupId); // reselect to keep view
    } catch (e: any) {
      setError(e?.message || "No se pudo guardar la opción");
    }
  }

  async function removeOption(id: string) {
    if (!window.confirm("¿Eliminar esta opción?")) return;
    try {
      setError(null);
      setMessage(null);
      const resp = await fetch(/api/admin/options?id=, { method: "DELETE" });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok || !j?.ok) throw new Error(j?.error || "No se pudo eliminar la opción");
      await load();
    } catch (e: any) {
      setError(e?.message || "No se pudo eliminar la opción");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Toppings y extras</h2>
        <p className="text-sm text-slate-600">
          Crea grupos reutilizables (por ejemplo "Topping 1 (salsa)", "Topping 2 (galleta)") y asigna opciones con recargos opcionales.
          Luego podrás vincular cada grupo a los productos que lo necesiten.
        </p>
      </section>

      <section className="rounded border bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">{editingGroupId ? "Editar grupo" : "Crear grupo"}</h3>
          {editingGroupId && (
            <button type="button" className="text-sm text-blue-600 hover:underline" onClick={resetGroupForm}>
              Cancelar
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm">
            <span className="text-slate-600">Nombre</span>
            <input className="mt-1 w-full rounded border px-3 py-2" value={groupForm.name} onChange={(e) => setGroupForm((prev) => ({ ...prev, name: e.target.value }))} />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Descripción</span>
            <input className="mt-1 w-full rounded border px-3 py-2" value={groupForm.description} onChange={(e) => setGroupForm((prev) => ({ ...prev, description: e.target.value }))} />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Tipo de selección</span>
            <select className="mt-1 w-full rounded border px-3 py-2" value={groupForm.selection_type} onChange={(e) => setGroupForm((prev) => ({ ...prev, selection_type: e.target.value as any }))}>
              <option value="single">Una sola opción (radio)</option>
              <option value="multiple">Varias opciones (checkbox)</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Obligatorio</span>
            <div className="mt-1 flex items-center gap-2">
              <input type="checkbox" checked={groupForm.is_required} onChange={(e) => setGroupForm((prev) => ({ ...prev, is_required: e.target.checked }))} />
              <span className="text-xs text-slate-600">El cliente debe completar este grupo para añadir el producto</span>
            </div>
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Mínimo</span>
            <input type="number" min="0" className="mt-1 w-full rounded border px-3 py-2" value={groupForm.min_select} onChange={(e) => setGroupForm((prev) => ({ ...prev, min_select: e.target.value }))} />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Máximo (opcional)</span>
            <input type="number" min="0" className="mt-1 w-full rounded border px-3 py-2" value={groupForm.max_select} onChange={(e) => setGroupForm((prev) => ({ ...prev, max_select: e.target.value }))} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void saveGroup()} className="rounded bg-emerald-600 px-4 py-2 text-white">{editingGroupId ? "Actualizar grupo" : "Crear grupo"}</button>
          <button type="button" onClick={resetGroupForm} className="rounded border px-3 py-2 text-sm">Limpiar</button>
        </div>
      </section>

      <section className="rounded border bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-base font-semibold">Grupos disponibles</h3>
        {loading ? (
          <div className="text-sm text-slate-500">Cargando...</div>
        ) : groups.length === 0 ? (
          <div className="text-sm text-slate-500">Todavía no hay grupos creados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="border-b px-3 py-2">Nombre</th>
                  <th className="border-b px-3 py-2">Tipo</th>
                  <th className="border-b px-3 py-2">Requerido</th>
                  <th className="border-b px-3 py-2 text-right">Opciones</th>
                  <th className="border-b px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.id} className={hover:bg-slate-50 }>
                    <td className="border-b px-3 py-2">
                      <div className="font-medium">{group.name}</div>
                      {group.description && <div className="text-xs text-slate-500">{group.description}</div>}
                    </td>
                    <td className="border-b px-3 py-2">{group.selection_type === "single" ? "Única" : "Múltiple"}</td>
                    <td className="border-b px-3 py-2">{group.is_required ? "Sí" : "No"}</td>
                    <td className="border-b px-3 py-2 text-right">{group.options_count || 0}</td>
                    <td className="border-b px-3 py-2 text-right space-x-2">
                      <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => setSelectedGroupId(group.id)}>
                        Opciones
                      </button>
                      <button type="button" className="text-xs text-slate-600 hover:underline" onClick={() => startEditGroup(group)}>
                        Editar
                      </button>
                      <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => removeGroup(group.id)}>
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedGroupId && (
        <section className="rounded border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold">Opciones del grupo</h3>
            {groups.find((g) => g.id === selectedGroupId)?.name && (
              <span className="text-sm text-slate-500">{groups.find((g) => g.id === selectedGroupId)?.name}</span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="text-sm">
              <span className="text-slate-600">Nombre</span>
              <input className="mt-1 w-full rounded border px-3 py-2" value={optionForm.name} onChange={(e) => setOptionForm((prev) => ({ ...prev, name: e.target.value }))} />
            </label>
            <label className="text-sm">
              <span className="text-slate-600">Recargo (€)</span>
              <input type="number" step="0.01" className="mt-1 w-full rounded border px-3 py-2" value={optionForm.price_delta} onChange={(e) => setOptionForm((prev) => ({ ...prev, price_delta: e.target.value }))} />
            </label>
            <label className="text-sm">
              <span className="text-slate-600">Orden</span>
              <input type="number" className="mt-1 w-full rounded border px-3 py-2" value={optionForm.sort_order} onChange={(e) => setOptionForm((prev) => ({ ...prev, sort_order: e.target.value }))} />
            </label>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button type="button" onClick={() => void saveOption()} className="rounded bg-emerald-600 px-4 py-2 text-white">{optionForm.id ? "Actualizar opción" : "Añadir opción"}</button>
            <button type="button" onClick={resetOptionForm} className="rounded border px-3 py-2 text-sm">Limpiar</button>
          </div>

          <div className="mt-6">
            {selectedOptions.length === 0 ? (
              <p className="text-sm text-slate-500">Este grupo aún no tiene opciones.</p>
            ) : (
              <ul className="divide-y rounded border">
                {selectedOptions.map((opt) => (
                  <li key={opt.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div>
                      <div className="font-medium">{opt.name}</div>
                      <div className="text-xs text-slate-500">
                        {opt.price_delta ? + € : "Sin recargo"} · Orden: {opt.sort_order}
                      </div>
                    </div>
                    <div className="space-x-2">
                      <button type="button" className="text-xs text-slate-600 hover:underline" onClick={() => startEditOption(opt)}>
                        Editar
                      </button>
                      <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => removeOption(opt.id)}>
                        Quitar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {(message || error) && (
        <div className="rounded border border-slate-200 bg-white p-3 text-sm">
          {message && <p className="text-emerald-700">{message}</p>}
          {error && <p className="text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
