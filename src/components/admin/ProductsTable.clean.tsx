"use client";

import React, { useMemo, useRef, useState } from "react";

type Category = { id: number; name: string; sort_order?: number | null };
type Product = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  available: boolean;
  category_id: number | null;
  sort_order?: number | null;
};

type Props = {
  initialProducts: Product[];
  categories: Category[];
  initialWeekdays?: Record<number, number[]>;
};

function WeekdaySelector({ value, onChange, compact }: { value: number[]; onChange: (v: number[]) => void; compact?: boolean }) {
  const days = [
    { d: 1, label: 'L' }, { d: 2, label: 'M' }, { d: 3, label: 'X' },
    { d: 4, label: 'J' }, { d: 5, label: 'V' }, { d: 6, label: 'S' }, { d: 7, label: 'D' },
  ];
  function toggle(day: number, checked: boolean) {
    const set = new Set(value);
    if (checked) set.add(day); else set.delete(day);
    const arr = Array.from(set).sort((a, b) => a - b);
    onChange(arr);
  }
  return (
    <div className={compact ? 'flex gap-2' : 'flex flex-wrap gap-3'}>
      {days.map(({ d, label }) => (
        <label key={d} className="inline-flex items-center gap-1 text-sm">
          <input type="checkbox" checked={value.includes(d)} onChange={(e) => toggle(d, e.target.checked)} />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}

export default function ProductsTable({ initialProducts, categories, initialWeekdays }: Props) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const [weekdays, setWeekdays] = useState<Record<number, number[]>>(initialWeekdays || {});
  const [menuMode, setMenuMode] = useState<'fixed' | 'daily'>('fixed');
  const [cats, setCats] = useState<Category[]>(categories);

  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/admin/business', { cache: 'no-store' });
        const j = await r.json();
        if (j?.ok && (j.data?.menu_mode === 'daily' || j.data?.menu_mode === 'fixed')) setMenuMode(j.data.menu_mode);
      } catch {}
    })();
  }, []);

  // Filtros
  const [filterCat, setFilterCat] = useState<number | "">("");
  const [filterName, setFilterName] = useState("");
  const [filterAvail, setFilterAvail] = useState<"all" | "yes" | "no">("all");
  const [priceMin, setPriceMin] = useState<number | "">("");
  const [priceMax, setPriceMax] = useState<number | "">("");

  // Form crear
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState<number | "">("");
  const [newCat, setNewCat] = useState<number | "">("");
  const [newDesc, setNewDesc] = useState("");
  const [newAvail, setNewAvail] = useState(true);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newFilePreview, setNewFilePreview] = useState<string | null>(null);
  const [newDays, setNewDays] = useState<number[]>([]);
  const ALL_DAYS = [1,2,3,4,5,6,7];

  React.useEffect(() => {
    if (!newFile) { setNewFilePreview(null); return; }
    try {
      const url = URL.createObjectURL(newFile);
      setNewFilePreview(url);
      return () => URL.revokeObjectURL(url);
    } catch { setNewFilePreview(null); }
  }, [newFile]);

  // Edición
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<Partial<Product>>({});
  const [editDays, setEditDays] = useState<number[]>([]);

  // Subida de imagen
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<number | null>(null);

  const catById = useMemo(() => new Map(cats.map((c) => [c.id, c.name] as const)), [cats]);

  async function reloadCats() {
    try {
      const r = await fetch('/api/admin/categories', { cache: 'no-store' });
      const j = await r.json();
      if (j?.ok && Array.isArray(j.categories)) setCats(j.categories);
    } catch {}
  }
  React.useEffect(() => { void reloadCats(); }, []);

  function resetNewForm() {
    setNewName(""); setNewPrice(""); setNewCat(""); setNewDesc(""); setNewAvail(true); setNewFile(null); setNewDays([]);
  }

  function resetFilters() { setFilterCat(""); setFilterName(""); setFilterAvail("all"); setPriceMin(""); setPriceMax(""); }

  function CategoriesManager() {
    const [newCatName, setNewCatName] = useState("");
    const [busy, setBusy] = useState(false);

    async function addCategory() {
      if (!newCatName.trim()) return;
      try {
        setBusy(true);
        const res = await fetch('/api/admin/categories', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: newCatName.trim() }) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j?.ok) throw new Error(j?.error || 'No se pudo crear la categoría');
        setNewCatName(""); await reloadCats();
      } catch (e: any) { alert(e?.message || 'Error'); } finally { setBusy(false); }
    }

    async function renameCategory(id: number, name: string) {
      try {
        setBusy(true);
        const res = await fetch('/api/admin/categories', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, name }) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j?.ok) throw new Error(j?.error || 'No se pudo renombrar');
        await reloadCats();
      } catch (e: any) { alert(e?.message || 'Error'); } finally { setBusy(false); }
    }

    async function reorder(id: number, dir: -1 | 1) {
      const idx = cats.findIndex(c => c.id === id);
      if (idx < 0) return;
      const targetIdx = idx + (dir as number);
      if (targetIdx < 0 || targetIdx >= cats.length) return;
      const me = cats[idx];
      const neighbor = cats[targetIdx];
      try {
        setBusy(true);
        const next = cats.slice();
        [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
        const r1 = await fetch('/api/admin/categories', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: me.id, sort_order: targetIdx }) });
        if (!r1.ok) throw new Error('No se pudo guardar el orden');
        const r2 = await fetch('/api/admin/categories', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: neighbor.id, sort_order: idx }) });
        if (!r2.ok) throw new Error('No se pudo guardar el orden');
        setCats(next); await reloadCats();
      } catch (e: any) { alert(e?.message || 'Error'); } finally { setBusy(false); }
    }

    async function remove(id: number) {
      if (!confirm('¿Eliminar la categoría? Si tiene productos no se podrá borrar.')) return;
      try {
        setBusy(true);
        const res = await fetch(`/api/admin/categories?id=${id}`, { method: 'DELETE' });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j?.ok) throw new Error(j?.error || 'No se pudo eliminar');
        await reloadCats();
      } catch (e: any) { alert(e?.message || 'Error'); } finally { setBusy(false); }
    }

    return (
      <div className="mb-4 rounded border bg-white p-3 shadow-sm">
        <div className="mb-2 text-sm font-medium">Categorías</div>
        <div className="mb-3 flex items-center gap-2">
          <input className="w-full rounded border px-2 py-1" placeholder="Nueva categoría" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
          <button onClick={addCategory} disabled={busy || !newCatName.trim()} className="rounded bg-emerald-600 px-3 py-1 text-white disabled:opacity-60">Añadir</button>
        </div>
        <ul className="space-y-2">
          {cats.map((c, idx) => (
            <li key={c.id} className="flex items-center gap-2">
              <input className="flex-1 rounded border px-2 py-1" defaultValue={c.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.name) renameCategory(c.id, v); }} />
              <button onClick={() => reorder(c.id, -1)} disabled={busy || idx===0} className="rounded border px-2 py-1">↑</button>
              <button onClick={() => reorder(c.id, +1)} disabled={busy || idx===cats.length-1} className="rounded border px-2 py-1">↓</button>
              <button onClick={() => remove(c.id)} disabled={busy} className="rounded border px-2 py-1 text-red-600">Eliminar</button>
            </li>
          ))}
          {cats.length === 0 && (<li className="text-sm text-gray-500">Sin categorías todavía.</li>)}
        </ul>
      </div>
    );
  }

  async function refresh() {
    const res = await fetch("/api/admin/orders/products", { cache: "no-store" });
    const { products: p, weekdays: wd } = await res.json();
    setProducts(p ?? []);
    setWeekdays(wd ?? {});
  }

  // Crear producto y (opcional) subir imagen
  async function onCreate() {
    if (!newName.trim()) return;
    setLoading(true);
    const body: any = {
      name: newName.trim(),
      price: Number(newPrice || 0),
      category_id: newCat === "" ? null : Number(newCat),
      description: newDesc.trim() || null,
      available: newAvail,
      image_url: null,
    };
    if (menuMode === 'daily') body.weekdays = newDays.slice();
    const res = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { setLoading(false); alert("Error al crear producto"); return; }
    const { id } = (await res.json()) as { id: number };
    if (id && newFile) {
      const fd = new FormData(); fd.append("id", String(id)); fd.append("file", newFile);
      const up = await fetch("/api/products", { method: "PATCH", body: fd });
      if (!up.ok) { setLoading(false); alert("Producto creado, pero error al subir la imagen"); await refresh(); resetNewForm(); return; }
    }
    setLoading(false); await refresh(); resetNewForm();
  }

  // Eliminar
  async function onDelete(id: number) {
    if (!confirm("¿Eliminar producto?")) return;
    setLoading(true);
    const res = await fetch(`/api/products?id=${id}`, { method: "DELETE" });
    setLoading(false);
    if (!res.ok) { alert("Error al eliminar"); return; }
    await refresh();
  }

  // Edición
  function startEdit(p: Product) {
    setEditingId(p.id);
    setEditRow({ id: p.id, name: p.name, description: p.description, price: p.price, available: p.available, category_id: p.category_id });
    setEditDays(weekdays[p.id] ? [...weekdays[p.id]] : []);
  }

  async function saveEdit() {
    if (!editingId) return; setLoading(true);
    const payload: any = { id: editingId, ...editRow, price: parseFloat(String(editRow.price ?? 0)) };
    if (menuMode === 'daily') payload.weekdays = editDays.slice();
    const res = await fetch("/api/products", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setLoading(false);
    if (!res.ok) { const txt = await res.text().catch(() => ""); alert("Error al guardar cambios" + (txt ? `: ${txt}` : "")); return; }
    setWeekdays((prev) => ({ ...prev, [editingId]: menuMode === 'daily' ? editDays.slice() : (prev[editingId] || []) }));
    setEditingId(null); setEditRow({}); await refresh();
  }
  function cancelEdit() { setEditingId(null); setEditRow({}); }

  // Cambiar imagen
  function triggerUpload(id: number) { setUploadTargetId(id); fileRef.current?.click(); }
  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f || !uploadTargetId) return; setLoading(true);
    const fd = new FormData(); fd.append("id", String(uploadTargetId)); fd.append("file", f);
    const res = await fetch("/api/products", { method: "PATCH", body: fd }); setLoading(false); e.target.value = ""; setUploadTargetId(null);
    if (!res.ok) { const txt = await res.text().catch(() => ""); alert("Error al subir imagen" + (txt ? `: ${txt}` : "")); return; }
    await refresh();
  }

  // Toggle disponible
  async function toggleAvailable(p: Product, checked: boolean) {
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, available: checked } : x)));
    const res = await fetch("/api/products", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, available: checked }) });
    if (!res.ok) { setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, available: !checked } : x))); alert("No se pudo actualizar disponible"); }
  }

  // Lista con filtros y orden
  const view = useMemo(() => {
    let arr = products.slice();
    if (filterCat !== "") arr = arr.filter((p) => p.category_id === Number(filterCat));
    const q = filterName.trim().toLowerCase(); if (q) arr = arr.filter((p) => p.name.toLowerCase().includes(q));
    if (filterAvail !== "all") arr = arr.filter((p) => (filterAvail === "yes" ? p.available : !p.available));
    if (priceMin !== "") arr = arr.filter((p) => Number(p.price) >= Number(priceMin));
    if (priceMax !== "") arr = arr.filter((p) => Number(p.price) <= Number(priceMax));
    arr.sort((a, b) => (a.category_id ?? 0) - (b.category_id ?? 0) || (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));
    return arr;
  }, [products, filterCat, filterName, filterAvail, priceMin, priceMax]);

  return (
    <div className="space-y-6">
      {/* input para subir imagen */}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFilePicked} />

      <CategoriesManager />

      {/* Filtros */}
      <div className="rounded border bg-white p-3 shadow-sm">
        <div className="mb-2 text-sm font-medium">Filtros</div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
          <div>
            <label className="text-xs text-gray-500">Categoría</label>
            <select className="w-full rounded border px-2 py-1" value={filterCat} onChange={(e) => setFilterCat(e.target.value === "" ? "" : Number(e.target.value))}>
              <option value="">Todas</option>
              {cats.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Nombre</label>
            <input className="w-full rounded border px-2 py-1" value={filterName} onChange={(e) => setFilterName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Disponible</label>
            <select className="w-full rounded border px-2 py-1" value={filterAvail} onChange={(e) => setFilterAvail(e.target.value as any)}>
              <option value="all">Todos</option>
              <option value="yes">Sí</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Precio min</label>
            <input type="number" step="0.01" className="w-full rounded border px-2 py-1" value={String(priceMin)} onChange={(e) => setPriceMin(e.target.value === "" ? "" : Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Precio max</label>
            <input type="number" step="0.01" className="w-full rounded border px-2 py-1" value={String(priceMax)} onChange={(e) => setPriceMax(e.target.value === "" ? "" : Number(e.target.value))} />
          </div>
          <div>
            <button onClick={resetFilters} className="rounded border px-3 py-1">Limpiar</button>
          </div>
        </div>
      </div>

      {/* Alta de producto */}
      <div className="rounded border bg-white p-3 shadow-sm">
        <div className="mb-2 text-sm font-medium">Añadir producto</div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
          <input className="rounded border px-2 py-1 md:col-span-2" placeholder="Nombre" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input type="number" step="0.01" className="rounded border px-2 py-1" placeholder="Precio" value={String(newPrice)} onChange={(e) => setNewPrice(e.target.value === "" ? "" : Number(e.target.value))} />
          <select className="rounded border px-2 py-1" value={newCat} onChange={(e) => setNewCat(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="">Sin categoría</option>
            {cats.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
          <input className="rounded border px-2 py-1 md:col-span-2" placeholder="Descripción" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={newAvail} onChange={(e) => setNewAvail(e.target.checked)} />
            <span>Disponible</span>
          </label>
          <div className="md:col-span-6 flex items-center gap-3">
            <input type="file" accept="image/*" onChange={(e) => setNewFile(e.target.files?.[0] || null)} />
            {newFile && <span className="text-xs text-gray-500">{newFile.name}</span>}
            {newFile && <button onClick={() => setNewFile(null)} className="rounded border px-2 py-1">Quitar</button>}
          </div>
          {menuMode === 'daily' && (
            <div className="md:col-span-6 space-y-2">
              <div className="text-sm">Días disponibles</div>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={newDays.length === 7} onChange={(e) => setNewDays(e.target.checked ? ALL_DAYS.slice() : [])} />
                  <span>Todos los días</span>
                </label>
              </div>
              <WeekdaySelector value={newDays} onChange={setNewDays} />
            </div>
          )}
          <div className="md:col-span-6">
            <button onClick={onCreate} disabled={loading || !newName.trim()} className="rounded bg-emerald-600 px-3 py-1 text-white disabled:opacity-60">Crear</button>
          </div>
        </div>
      </div>

      {/* Tabla de productos */}
      <div className="rounded border bg-white p-3 shadow-sm">
        <div className="mb-2 text-sm font-medium">Listado</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="px-3 py-2">Imagen</th>
              <th className="px-3 py-2">Producto</th>
              <th className="px-3 py-2">Precio</th>
              <th className="px-3 py-2">Disponible</th>
              <th className="px-3 py-2">Categoría</th>
              <th className="px-3 py-2 w-[160px] text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {view.map((p) => {
              if (editingId === p.id) {
                return (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-2">{p.image_url ? <img src={p.image_url} alt="" className="h-10 w-16 rounded object-cover" /> : <span className="text-gray-400">-</span>}</td>
                    <td className="px-3 py-2">
                      <input className="w-full rounded border px-2 py-1" value={editRow.name ?? ''} onChange={(e) => setEditRow((r) => ({ ...r, name: e.target.value }))} />
                      <input className="mt-2 w-full rounded border px-2 py-1" value={editRow.description ?? ''} onChange={(e) => setEditRow((r) => ({ ...r, description: e.target.value }))} placeholder="Descripción" />
                      {menuMode === 'daily' && (
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <label className="inline-flex items-center gap-2">
                              <input type="checkbox" checked={editDays.length === 7} onChange={(e) => setEditDays(e.target.checked ? ALL_DAYS.slice() : [])} />
                              <span>Todos los días</span>
                            </label>
                          </div>
                          <WeekdaySelector value={editDays} onChange={setEditDays} compact />
                        </div>
                      )}
                    </td>
                    <td className="w-[120px] px-3 py-2">
                      <input type="number" step="0.01" className="w-[110px] rounded border px-2 py-1" value={String(editRow.price ?? 0)} onChange={(e) => setEditRow((r) => ({ ...r, price: e.target.value === '' ? 0 : Number(e.target.value) }))} />
                    </td>
                    <td className="w-[110px] px-3 py-2">
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={!!editRow.available} onChange={(e) => setEditRow((r) => ({ ...r, available: e.target.checked }))} />
                        <span>{editRow.available ? 'Sí' : 'No'}</span>
                      </label>
                    </td>
                    <td className="w-[220px] px-3 py-2">
                      <select className="w-full rounded border px-2 py-1" value={editRow.category_id ?? ''} onChange={(e) => setEditRow((r) => ({ ...r, category_id: e.target.value === '' ? null : Number(e.target.value) }))}>
                        <option value="">Sin categoría</option>
                        {cats.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2 justify-end">
                        <button onClick={saveEdit} disabled={loading} className="rounded bg-emerald-600 px-3 py-1 text-white disabled:opacity-60">Guardar</button>
                        <button onClick={cancelEdit} className="rounded bg-gray-200 px-3 py-1">Cancelar</button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={p.id} className="border-t bg-white even:bg-gray-50 hover:bg-gray-100">
                  <td className="px-3 py-2">{p.image_url ? <img src={p.image_url} alt="" className="h-10 w-16 rounded object-cover" /> : <span className="text-gray-400">-</span>}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{p.name}</div>
                    {p.description ? <div className="mt-1 text-xs text-gray-500">{p.description}</div> : null}
                  </td>
                  <td className="px-3 py-2">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(p.price))}</td>
                  <td className="px-3 py-2">
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={p.available} onChange={(e) => toggleAvailable(p, e.target.checked)} />
                      <span>{p.available ? 'Sí' : 'No'}</span>
                    </label>
                  </td>
                  <td className="px-3 py-2">{p.category_id ? catById.get(p.category_id) || '-' : '-'}</td>
                  <td className="px-3 py-2">
                    <div className="flex w-full justify-end gap-2">
                      <button onClick={() => startEdit(p)} className="inline-flex h-9 w-9 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700" title="Editar producto" aria-label="Editar producto">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M16.862 3.487a1.75 1.75 0 0 1 2.476 2.476l-9.8 9.8a4 4 0 0 1-1.693.99l-2.707.77a.75.75 0 0 1-.923-.923l.77-2.707a4 4 0 0 1 .99-1.693l9.8-9.8Z"/><path d="M5.25 19.5h13.5a.75.75 0 0 1 0 1.5H5.25a.75.75 0 0 1 0-1.5Z"/></svg>
                      </button>
                      <button onClick={() => triggerUpload(p.id)} className="inline-flex h-9 w-9 items-center justify-center rounded bg-gray-700 text-white hover:bg-gray-800" title="Cambiar imagen del producto" aria-label="Cambiar imagen del producto">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M9 3a1 1 0 0 0-.894.553L7.105 5H5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3h-2.105l-.999-1.447A1 1 0 0 0 14.999 3H9Zm3 5.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z"/></svg>
                      </button>
                      <button onClick={() => onDelete(p.id)} className="inline-flex h-9 w-9 items-center justify-center rounded bg-red-600 text-white hover:bg-red-700" title="Eliminar producto" aria-label="Eliminar producto">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

