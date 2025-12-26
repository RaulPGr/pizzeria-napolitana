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

// Selector de días para los modos de carta "daily".
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

// Componente principal del panel de productos (listar/crear/editar).
export default function ProductsTable({ initialProducts, categories, initialWeekdays }: Props) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const [weekdays, setWeekdays] = useState<Record<number, number[]>>(initialWeekdays || {});
  const [menuMode, setMenuMode] = useState<'fixed' | 'daily'>('fixed');
  const [cats, setCats] = useState<Category[]>(categories);

  // Crea una URL temporal para mostrar la imagen seleccionada antes de subirla.
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

  // Comprime imágenes grandes en cliente para evitar superar límites al subirlas.
  async function compressImage(file: File, maxW = 1400, maxH = 1400, quality = 0.84): Promise<File> {
    try {
      if (!file || !(file instanceof File)) return file;
      if (file.size <= 3 * 1024 * 1024) return file; // ya es razonable
      const url = URL.createObjectURL(file);
      const img = new Image();
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); img.src = url; });
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      let w = iw, h = ih;
      const scale = Math.min(maxW / iw, maxH / ih, 1);
      w = Math.max(1, Math.round(iw * scale));
      h = Math.max(1, Math.round(ih * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(img, 0, 0, w, h);
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      URL.revokeObjectURL(url);
      if (!blob) return file;
      const name = (file.name || 'image').replace(/\.[^.]+$/, '.jpg');
      return new File([blob], name, { type: 'image/jpeg' });
    } catch {
      return file;
    }
  }

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
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editFilePreview, setEditFilePreview] = useState<string | null>(null);
  const [editZoom, setEditZoom] = useState(1);
  const [editOffsetX, setEditOffsetX] = useState(0);
  const [editOffsetY, setEditOffsetY] = useState(0);

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

  // Widget para crear/renombrar/eliminar categorías desde la misma pantalla.
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
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input className="w-full rounded border px-2 py-1" placeholder="Nueva categoría" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
          <button onClick={addCategory} disabled={busy || !newCatName.trim()} className="rounded bg-emerald-600 px-3 py-1 text-white disabled:opacity-60">Añadir</button>
        </div>
        <ul className="space-y-2">
          {cats.map((c, idx) => (
            <li key={c.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input className="flex-1 rounded border px-2 py-1" defaultValue={c.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.name) renameCategory(c.id, v); }} />
              <div className="flex gap-2 sm:flex-nowrap flex-wrap">
                <button onClick={() => reorder(c.id, -1)} disabled={busy || idx===0} className="rounded border px-2 py-1">↑</button>
                <button onClick={() => reorder(c.id, +1)} disabled={busy || idx===cats.length-1} className="rounded border px-2 py-1">↓</button>
                <button onClick={() => remove(c.id)} disabled={busy} className="rounded border px-2 py-1 text-red-600">Eliminar</button>
              </div>
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
      const compact = await compressImage(newFile);
      const fd = new FormData(); fd.append("id", String(id)); fd.append("file", compact);
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
    setEditModalOpen(true);
    setEditFile(null);
    setEditFilePreview(null);
    setEditZoom(1);
    setEditOffsetX(0);
    setEditOffsetY(0);
  }

  async function saveEdit() {
    if (!editingId) return; setLoading(true);
    const payload: any = { id: editingId, ...editRow, price: parseFloat(String(editRow.price ?? 0)) };
    if (menuMode === 'daily') payload.weekdays = editDays.slice();
    const res = await fetch("/api/products", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setLoading(false);
    if (!res.ok) { const txt = await res.text().catch(() => ""); alert("Error al guardar cambios" + (txt ? `: ${txt}` : "")); return; }
    setWeekdays((prev) => ({ ...prev, [editingId]: menuMode === 'daily' ? editDays.slice() : (prev[editingId] || []) }));
    setEditingId(null); setEditRow({}); setEditModalOpen(false); setEditFile(null); setEditFilePreview(null); await refresh();
  }
  function cancelEdit() { setEditingId(null); setEditRow({}); setEditModalOpen(false); setEditFile(null); setEditFilePreview(null); setEditZoom(1); setEditOffsetX(0); setEditOffsetY(0); }

  // Seleccionar imagen (mostrar vista previa antes de subir)
  function triggerUpload(id: number) { setUploadTargetId(id); fileRef.current?.click(); }
  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !uploadTargetId) return;
    if (editingId && uploadTargetId === editingId) {
      try {
        const url = URL.createObjectURL(f);
        setEditFile(f);
        setEditFilePreview(url);
        setEditZoom(1);
        setEditOffsetX(0);
        setEditOffsetY(0);
      } catch {
        setEditFile(f);
        setEditFilePreview(null);
      }
      e.target.value = "";
      return;
    }
    // flujo antiguo (no debería usarse ya), sube directamente
    setLoading(true);
    const compact = await compressImage(f);
    const fd = new FormData(); fd.append("id", String(uploadTargetId)); fd.append("file", compact);
    const res = await fetch("/api/products", { method: "PATCH", body: fd }); setLoading(false); e.target.value = ""; setUploadTargetId(null);
    if (!res.ok) { const txt = await res.text().catch(() => ""); alert("Error al subir imagen" + (txt ? `: ${txt}` : "")); return; }
    await refresh();
  }

  async function buildEditedImage(file: File): Promise<File> {
    // Aplica zoom y desplazamiento antes de subir.
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); img.src = url; });
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      // Tamaño objetivo máximo
      const MAX_W = 1400, MAX_H = 1400;
      const baseScale = Math.min(MAX_W / iw, MAX_H / ih, 1);
      const finalScale = baseScale * Math.max(1, editZoom || 1);
      const drawW = Math.max(1, Math.round(iw * finalScale));
      const drawH = Math.max(1, Math.round(ih * finalScale));
      const canvasW = Math.min(drawW, MAX_W);
      const canvasH = Math.min(drawH, MAX_H);
      const canvas = document.createElement('canvas');
      canvas.width = canvasW; canvas.height = canvasH;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); return file; }
      // Centrado + offset (offset -0.5..0.5)
      const extraX = canvasW - drawW;
      const extraY = canvasH - drawH;
      const offsetX = extraX / 2 + (editOffsetX || 0) * canvasW * 0.5;
      const offsetY = extraY / 2 + (editOffsetY || 0) * canvasH * 0.5;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0,0,canvasW,canvasH);
      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      URL.revokeObjectURL(url);
      if (!blob) return file;
      const name = (file.name || 'image').replace(/\.[^.]+$/, '.jpg');
      return new File([blob], name, { type: 'image/jpeg' });
    } catch {
      return file;
    }
  }

  async function uploadPendingImage() {
    if (!editFile || !editingId) return;
    setLoading(true);
    try {
      const edited = await buildEditedImage(editFile);
      const compact = await compressImage(edited);
      const fd = new FormData(); fd.append("id", String(editingId)); fd.append("file", compact);
      const res = await fetch("/api/products", { method: "PATCH", body: fd });
      if (!res.ok) {
        const txt = await res.text().catch(() => ""); throw new Error(txt || 'Error al subir imagen');
      }
      setEditFile(null); setEditFilePreview(null);
      setEditZoom(1); setEditOffsetX(0); setEditOffsetY(0);
      await refresh();
    } catch (err: any) {
      alert(err?.message || 'No se pudo subir la imagen');
    } finally {
      setLoading(false);
    }
  }

  // Permite tomar la imagen ya subida y abrirla en modo de ajuste (zoom/posiciÃ³n).
  async function startAdjustExistingImage(url?: string | null) {
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const fname = (url.split('/').pop() || 'imagen') + '.jpg';
      const file = new File([blob], fname, { type: blob.type || 'image/jpeg' });
      const preview = URL.createObjectURL(file);
      setEditFile(file);
      setEditFilePreview(preview);
      setEditZoom(1);
      setEditOffsetX(0);
      setEditOffsetY(0);
    } catch {
      alert('No se pudo cargar la imagen existente para editar.');
    }
  }

  // Quitar imagen del producto
  async function removeImage(id: number) {
    if (!confirm("¿Eliminar la imagen del producto?")) return;
    setLoading(true);
    const res = await fetch("/api/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, image_url: null }),
    });
    setLoading(false);
    if (!res.ok) { const txt = await res.text().catch(() => ""); alert("Error al quitar imagen" + (txt ? `: ${txt}` : "")); return; }
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
          <textarea className="rounded border px-2 py-2 md:col-span-3 h-24 resize-y" placeholder="Descripción" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={newAvail} onChange={(e) => setNewAvail(e.target.checked)} />
            <span>Disponible</span>
          </label>
          <div className="md:col-span-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <input type="file" accept="image/*" onChange={(e) => setNewFile(e.target.files?.[0] || null)} />
            {newFile && <span className="text-xs text-gray-500 break-all">{newFile.name}</span>}
            {newFile && <button onClick={() => setNewFile(null)} className="rounded border px-2 py-1 w-full sm:w-auto">Quitar</button>}
            {newFilePreview && (
              <img
                src={newFilePreview}
                alt="Vista previa"
                className="h-20 w-28 rounded border object-cover"
              />
            )}
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

      {/* Filtros (movidos justo encima del listado) */}
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

      {/* Tabla de productos */}
      <div className="rounded border bg-white p-3 shadow-sm">
        <div className="mb-2 text-sm font-medium">Listado</div>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
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
            {view.map((p) => (
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
                  <div className="flex w-full flex-wrap justify-end gap-2">
                    <button onClick={() => startEdit(p)} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700" title="Actualizar producto" aria-label="Actualizar producto">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M16.862 3.487a1.75 1.75 0 0 1 2.476 2.476l-9.8 9.8a4 4 0 0 1-1.693.99l-2.707.77a.75.75 0 0 1-.923-.923l.77-2.707a4 4 0 0 1 .99-1.693l9.8-9.8Z"/><path d="M5.25 19.5h13.5a.75.75 0 0 1 0 1.5H5.25a.75.75 0 0 1 0-1.5Z"/></svg>
                      <span className="text-sm">Actualizar</span>
                    </button>
                    <button onClick={() => onDelete(p.id)} className="inline-flex h-9 w-9 items-center justify-center rounded bg-red-600 text-white hover:bg-red-700" title="Eliminar producto" aria-label="Eliminar producto">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Modal edición producto */}
      {editModalOpen && editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Actualizar producto</h3>
                <p className="text-sm text-slate-600">Edita los datos y guarda los cambios.</p>
              </div>
              <button onClick={cancelEdit} className="text-slate-500 hover:text-slate-700">✕</button>
            </div>
            {(() => {
              const modalProduct = products.find((x) => x.id === editingId);
              return (
                <div className="space-y-4">
                                    <div className="flex flex-col gap-3 rounded border p-3">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start gap-3">
                        <div className="h-24 w-40 overflow-hidden rounded border border-slate-200 bg-slate-100">
                          {(() => {
                            const previewSrc = editFilePreview ?? modalProduct?.image_url ?? null;
                            if (!previewSrc) return <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">Sin imagen</div>;
                            const translateX = editFilePreview ? editOffsetX * 50 : 0;
                            const translateY = editFilePreview ? editOffsetY * 50 : 0;
                            const zoom = editFilePreview ? editZoom : 1;
                            return (
                              <img
                                src={previewSrc}
                                alt="Vista previa"
                                className="h-full w-full object-cover transition-transform"
                                style={{ transform: `translate(${translateX}%, ${translateY}%) scale(${zoom})`, transformOrigin: 'center' }}
                              />
                            );
                          })()}
                        </div>
                        <div className="flex flex-1 flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => triggerUpload(modalProduct?.id || 0)}
                            className="rounded border px-3 py-1 text-sm"
                          >
                            Seleccionar imagen
                          </button>
                          {modalProduct?.image_url && !editFilePreview && (
                            <button
                              type="button"
                              onClick={() => startAdjustExistingImage(modalProduct.image_url)}
                              className="rounded border px-3 py-1 text-sm"
                            >
                              Ajustar imagen actual
                            </button>
                          )}
                          {modalProduct?.image_url && (
                            <button
                              type="button"
                              onClick={() => removeImage(modalProduct.id)}
                              className="rounded border px-3 py-1 text-sm text-rose-600"
                            >
                              Quitar imagen
                            </button>
                          )}
                          {editFile && (
                            <button
                              type="button"
                              onClick={uploadPendingImage}
                              disabled={loading}
                              className="rounded bg-emerald-600 px-3 py-1 text-sm text-white disabled:opacity-60"
                            >
                              {loading ? 'Subiendo...' : 'Subir imagen'}
                            </button>
                          )}
                        </div>
                      </div>
                      {editFilePreview && (
                        <div className="grid gap-3 md:grid-cols-3">
                          <label className="flex flex-col gap-1 text-xs text-slate-600">
                            Zoom ({editZoom.toFixed(2)}x)
                            <input type="range" min={1} max={3} step={0.05} value={editZoom} onChange={(e) => setEditZoom(Number(e.target.value))} />
                          </label>
                          <label className="flex flex-col gap-1 text-xs text-slate-600">
                            Desplazar X ({Math.round(editOffsetX * 100)}%)
                            <input type="range" min={-0.5} max={0.5} step={0.01} value={editOffsetX} onChange={(e) => setEditOffsetX(Number(e.target.value))} />
                          </label>
                          <label className="flex flex-col gap-1 text-xs text-slate-600">
                            Desplazar Y ({Math.round(editOffsetY * 100)}%)
                            <input type="range" min={-0.5} max={0.5} step={0.01} value={editOffsetY} onChange={(e) => setEditOffsetY(Number(e.target.value))} />
                          </label>
                        </div>
                      )}
                    </div>
                    {editFilePreview && <div className="text-xs text-slate-500">Ajusta zoom y encuadre antes de subir la imagen. Al guardar no se sube solo: pulsa "Subir imagen".</div>}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Nombre</label>
                      <input
                        className="w-full rounded border px-3 py-2"
                        value={editRow.name ?? ''}
                        onChange={(e) => setEditRow((r) => ({ ...r, name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Precio</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full rounded border px-3 py-2"
                        value={String(editRow.price ?? 0)}
                        onChange={(e) => setEditRow((r) => ({ ...r, price: e.target.value === '' ? 0 : Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Descripción</label>
                    <textarea
                      className="w-full rounded border px-3 py-2"
                      rows={4}
                      value={editRow.description ?? ''}
                      onChange={(e) => setEditRow((r) => ({ ...r, description: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Categoría</label>
                      <select
                        className="w-full rounded border px-3 py-2"
                        value={editRow.category_id ?? ''}
                        onChange={(e) => setEditRow((r) => ({ ...r, category_id: e.target.value === '' ? null : Number(e.target.value) }))}
                      >
                        <option value="">Sin categoría</option>
                        {cats.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Disponible</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!editRow.available}
                          onChange={(e) => setEditRow((r) => ({ ...r, available: e.target.checked }))}
                        />
                        <span className="text-sm text-slate-700">{editRow.available ? 'Sí' : 'No'}</span>
                      </div>
                    </div>
                  </div>
                  {menuMode === 'daily' && (
                    <div className="space-y-2 rounded border p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <label className="inline-flex items-center gap-2">
                          <input type="checkbox" checked={editDays.length === 7} onChange={(e) => setEditDays(e.target.checked ? ALL_DAYS.slice() : [])} />
                          <span>Todos los días</span>
                        </label>
                      </div>
                      <WeekdaySelector value={editDays} onChange={setEditDays} compact />
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={cancelEdit} className="rounded border px-4 py-2 text-sm">Cancelar</button>
              <button onClick={saveEdit} disabled={loading} className="rounded bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-60">
                {loading ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}







