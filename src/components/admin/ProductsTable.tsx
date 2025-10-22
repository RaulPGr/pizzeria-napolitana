"use client";

import React, { useMemo, useRef, useState } from "react";

type Category = { id: number; name: string };
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

export default function ProductsTable({ initialProducts, categories, initialWeekdays }: Props) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const [weekdays, setWeekdays] = useState<Record<number, number[]>>(initialWeekdays || {});
  const [menuMode, setMenuMode] = useState<'fixed' | 'daily'>('fixed');

  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/admin/business', { cache: 'no-store' });
        const j = await r.json();
        if (j?.ok && (j.data?.menu_mode === 'daily' || j.data?.menu_mode === 'fixed')) {
          setMenuMode(j.data.menu_mode);
        }
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
  const [newDays, setNewDays] = useState<number[]>([]); // weekdays for daily mode (1..7)
  const ALL_DAYS = [1,2,3,4,5,6,7];

  // Vista previa de imagen del formulario de alta
  React.useEffect(() => {
    if (!newFile) { setNewFilePreview(null); return; }
    try {
      const url = URL.createObjectURL(newFile);
      setNewFilePreview(url);
      return () => URL.revokeObjectURL(url);
    } catch { setNewFilePreview(null); }
  }, [newFile]);

  function formatSize(bytes: number) {
    if (!bytes || bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${Math.round(kb)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
}

function WeekdaySelector({ value, onChange, compact }: { value: number[]; onChange: (v: number[]) => void; compact?: boolean }) {
  const days = [
    { d: 1, label: 'L' },
    { d: 2, label: 'M' },
    { d: 3, label: 'X' },
    { d: 4, label: 'J' },
    { d: 5, label: 'V' },
    { d: 6, label: 'S' },
    { d: 7, label: 'D' },
  ];
  function toggle(day: number, checked: boolean) {
    const set = new Set(value);
    if (checked) set.add(day); else set.delete(day);
    const arr = Array.from(set);
    arr.sort((a, b) => a - b);
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

  // Edición
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<Partial<Product>>({});

  // Subida de imagen
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<number | null>(null);
  const addFormRef = React.useRef<HTMLDivElement>(null);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c.name] as const)), [categories]);

  function resetNewForm() {
    setNewName("");
    setNewPrice("");
    setNewCat("");
    setNewDesc("");
    setNewAvail(true);
    setNewFile(null);
    setNewDays([]);
  }

  function resetFilters() {
    setFilterCat("");
    setFilterName("");
    setFilterAvail("all");
    setPriceMin("");
    setPriceMax("");
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
    if (menuMode === 'daily') {
      body.weekdays = newDays.slice();
    }
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
  const [editDays, setEditDays] = useState<number[]>([]);
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

  // Lista vista (filtros + orden)
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

      {/* Form crear */}
      <div ref={addFormRef}>
        <details className="rounded-md border p-4">
          <summary className="cursor-pointer select-none text-sm font-medium">Añadir producto</summary>
          <div className="space-y-3">
            <div className="mt-3" />
            <div className="flex flex-col max-w-xl">
              <label className="text-sm text-gray-700">Nombre del producto</label>
              <input className="border rounded px-3 py-2 w-full" placeholder="Ej. Croqueta de jamón" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="flex flex-col max-w-xs">
              <label className="text-sm text-gray-700">Precio</label>
              <input className="border rounded px-3 py-2" placeholder="0.00" type="number" step="0.01" value={newPrice} onChange={(e) => setNewPrice(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div className="flex flex-col max-w-xl">
              <label className="text-sm text-gray-700">Categoría</label>
              <select className="border rounded px-3 py-2 w-full" value={newCat} onChange={(e) => setNewCat(e.target.value === "" ? "" : Number(e.target.value))}>
                <option value="">Sin Categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col max-w-xl">
              <label className="text-sm text-gray-700">Imagen (opcional)</label>
              <input type="file" accept="image/*" className="border rounded px-3 py-2 w-full" onChange={(e) => { const f = e.target.files?.[0] || null; setNewFile(f); }} />
              {newFilePreview && newFile && (
                <div className="mt-2 flex items-center gap-3">
                  <img src={newFilePreview} alt="Vista previa" className="h-16 w-24 rounded object-cover border" />
                  <div className="text-xs text-gray-600">
                    <div className="font-medium truncate max-w-[220px]" title={newFile.name}>{newFile.name}</div>
                    <div>{formatSize(newFile.size)}</div>
                  </div>
                  <button type="button" className="text-sm text-gray-600 hover:underline" onClick={() => setNewFile(null)}>Quitar imagen</button>
                </div>
              )}
            </div>
            <div className="flex flex-col max-w-xl">
              <label className="text-sm text-gray-700">Descripción (opcional)</label>
              <textarea className="border rounded px-3 py-2 w-full" rows={3} placeholder="Describe el producto" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
            </div>
            {menuMode === 'daily' && (
              <div className="flex flex-col max-w-xl">
                <label className="text-sm text-gray-700">Dï¿½ï¿½as de la semana</label>
                <div className="mb-2">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={newDays.length === 7}
                      onChange={(e) => setNewDays(e.target.checked ? ALL_DAYS.slice() : [])}
                    />
                  <span>Todos los días</span>
                  </label>
                </div>
                <WeekdaySelector value={newDays} onChange={setNewDays} />
              </div>
            )}
            <label className="mt-1 inline-flex items-center gap-2"><input type="checkbox" checked={newAvail} onChange={(e) => setNewAvail(e.target.checked)} /><span>Disponible</span></label>
            <button onClick={onCreate} disabled={loading} className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-60">Añadir</button>
          </div>
        </details>
      </div>

      {/* Filtros */}
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr,160px,160px,160px,1fr,auto]">
        <input className="w-full rounded border px-3 py-2" placeholder="Buscar por nombre" value={filterName} onChange={(e) => setFilterName(e.target.value)} />
        <input className="w-full rounded border px-3 py-2" placeholder="Precio mín." value={priceMin === "" ? "" : String(priceMin)} onChange={(e) => setPriceMin(e.target.value === "" ? "" : Number(e.target.value))} />
        <input className="w-full rounded border px-3 py-2" placeholder="Precio máx." value={priceMax === "" ? "" : String(priceMax)} onChange={(e) => setPriceMax(e.target.value === "" ? "" : Number(e.target.value))} />
        <select className="w-full rounded border px-3 py-2" value={filterAvail} onChange={(e) => setFilterAvail(e.target.value as any)}>
          <option value="all">Todos</option>
          <option value="yes">Sí</option>
          <option value="no">No</option>
        </select>
        <select className="w-full rounded border px-3 py-2" value={filterCat} onChange={(e) => setFilterCat(e.target.value === "" ? "" : Number(e.target.value))}>
          <option value="">Todas</option>
          {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </select>
        <button onClick={resetFilters} className="h-[38px] rounded border px-3">Restablecer</button>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-md border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-3 py-2 text-left">Imagen</th>
              <th className="px-3 py-2 text-left">Nombre</th>
              <th className="px-3 py-2 text-left">Precio</th>
              <th className="px-3 py-2 text-left">Disponible</th>
              <th className="px-3 py-2 text-left">Categoría</th>
              <th className="px-3 py-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {view.map((p) => {
              const isEditing = editingId === p.id;
              if (isEditing) {
                return (
                  <tr key={p.id} className="border-t bg-white even:bg-gray-50 hover:bg-gray-100">
                    <td className="px-3 py-2">{p.image_url ? <img src={p.image_url} alt="" className="h-10 w-16 rounded object-cover" /> : <span className="text-gray-400">-</span>}</td>
                    <td className="px-3 py-2">
                      <input className="w-full rounded border px-2 py-1" value={editRow.name ?? ""} onChange={(e) => setEditRow((r) => ({ ...r, name: e.target.value }))} />
                      <div className="mt-1 text-xs text-gray-500">
                        <input className="w-full rounded border px-2 py-1" placeholder="Descripción (opcional)" value={editRow.description ?? ""} onChange={(e) => setEditRow((r) => ({ ...r, description: e.target.value }))} />
                      </div>
                      {menuMode === 'daily' && (
                        <div className="mt-2">
                          <div className="text-xs text-gray-700 mb-1">Dï¿½ï¿½as visibles</div>
                          <div className="mb-2">
                            <label className="inline-flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={editDays.length === 7}
                                onChange={(e) => setEditDays(e.target.checked ? ALL_DAYS.slice() : [])}
                              />
                              <span>Todos los días</span>
                            </label>
                          </div>
                          <WeekdaySelector value={editDays} onChange={setEditDays} compact />
                        </div>
                      )}
                    </td>
                    <td className="w-[120px] px-3 py-2">
                      <input type="number" step="0.01" className="w-[110px] rounded border px-2 py-1" value={String(editRow.price ?? 0)} onChange={(e) => setEditRow((r) => ({ ...r, price: e.target.value === "" ? 0 : Number(e.target.value) }))} />
                    </td>
                    <td className="w-[110px] px-3 py-2">
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={!!editRow.available} onChange={(e) => setEditRow((r) => ({ ...r, available: e.target.checked }))} />
                        <span>{editRow.available ? "Sí" : "No"}</span>
                      </label>
                    </td>
                    <td className="w-[220px] px-3 py-2">
                      <select className="w-full rounded border px-2 py-1" value={editRow.category_id ?? ""} onChange={(e) => setEditRow((r) => ({ ...r, category_id: e.target.value === "" ? null : Number(e.target.value) }))}>
                        <option value="">Sin Categoría</option>
                        {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
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
                      <span>{p.available ? "Sí" : "No"}</span>
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
