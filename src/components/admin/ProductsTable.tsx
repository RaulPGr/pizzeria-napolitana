﻿"use client";

import { useMemo, useRef, useState } from "react";

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
};

export default function ProductsTable({ initialProducts, categories }: Props) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [loading, setLoading] = useState(false);

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

  // EdiciÃ³n
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<Partial<Product>>({});

  // Subida de imagen
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<number | null>(null);

  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name] as const)),
    [categories]
  );

  function resetNewForm() {
    setNewName("");
    setNewPrice("");
    setNewCat("");
    setNewDesc("");
    setNewAvail(true);
    setNewFile(null);
  }

  function resetFilters() {
    setFilterCat("");
    setFilterName("");
    setFilterAvail("all");
    setPriceMin("");
    setPriceMax("");
  }

  async function refresh() {
    const res = await fetch("/api/products", { cache: "no-store" });
    const { products: p } = await res.json();
    setProducts(p ?? []);
  }

  // Crear producto y (opcional) subir imagen
  async function onCreate() {
    if (!newName.trim()) return;
    setLoading(true);
    const body = {
      name: newName.trim(),
      price: parseFloat(String(newPrice || 0)),
      category_id: newCat === "" ? null : Number(newCat),
      description: newDesc.trim() || null,
      available: !!newAvail,
    };
    const res = await fetch("/api/products", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      setLoading(false);
      alert("Error al crear producto");
      return;
    }
    const { id } = (await res.json()) as { id: number };

    if (id && newFile) {
      const fd = new FormData();
      fd.append("id", String(id));
      fd.append("file", newFile);
      const up = await fetch("/api/products", { method: "PATCH", body: fd });
      if (!up.ok) {
        setLoading(false);
        alert("Producto creado, pero error al subir la imagen");
        await refresh();
        resetNewForm();
        return;
      }
    }

    setLoading(false);
    await refresh();
    resetNewForm();
  }

  // Eliminar
  async function onDelete(id: number) {
    if (!confirm("Â¿Eliminar producto?")) return;
    setLoading(true);
    const res = await fetch(`/api/products?id=${id}`, { method: "DELETE" });
    setLoading(false);
    if (!res.ok) {
      alert("Error al eliminar");
      return;
    }
    await refresh();
  }

  // EdiciÃ³n
  function startEdit(p: Product) {
    setEditingId(p.id);
    setEditRow({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      available: p.available,
      category_id: p.category_id,
    });
  }

  async function saveEdit() {
    if (!editingId) return;
    setLoading(true);
    const res = await fetch("/api/products", {
      method: "PATCH",
      body: JSON.stringify({ id: editingId, ...editRow, price: parseFloat(String(editRow.price ?? 0)) }),
      headers: { "Content-Type": "application/json" },
    });
    setLoading(false);
    if (!res.ok) {
      alert("Error al guardar cambios");
      return;
    }
    setEditingId(null);
    setEditRow({});
    await refresh();
  }

  function cancelEdit() {
    setEditingId(null);
    setEditRow({});
  }

  // Cambiar imagen
  function triggerUpload(id: number) {
    setUploadTargetId(id);
    fileRef.current?.click();
  }
  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !uploadTargetId) return;
    setLoading(true);
    const fd = new FormData();
    fd.append("id", String(uploadTargetId));
    fd.append("file", f);
    const res = await fetch("/api/products", { method: "PATCH", body: fd });
    setLoading(false);
    e.target.value = "";
    setUploadTargetId(null);
    if (!res.ok) {
      alert("Error al subir imagen");
      return;
    }
    await refresh();
  }

  // Toggle disponible
  async function toggleAvailable(p: Product, checked: boolean) {
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, available: checked } : x)));
    const res = await fetch("/api/products", {
      method: "PATCH",
      body: JSON.stringify({ id: p.id, available: checked }),
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, available: !checked } : x)));
      alert("No se pudo actualizar disponible");
    }
  }

  // Lista vista (filtros + orden)
  const view = useMemo(() => {
    let arr = products.slice();
    if (filterCat !== "") arr = arr.filter((p) => p.category_id === Number(filterCat));
    const q = filterName.trim().toLowerCase();
    if (q) arr = arr.filter((p) => p.name.toLowerCase().includes(q));
    if (filterAvail !== "all") arr = arr.filter((p) => (filterAvail === "yes" ? p.available : !p.available));
    if (priceMin !== "") arr = arr.filter((p) => Number(p.price) >= Number(priceMin));
    if (priceMax !== "") arr = arr.filter((p) => Number(p.price) <= Number(priceMax));
    arr.sort(
      (a, b) =>
        (a.category_id ?? 0) - (b.category_id ?? 0) ||
        (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
        a.name.localeCompare(b.name)
    );
    return arr;
  }, [products, filterCat, filterName, filterAvail, priceMin, priceMax]);

  return (
    <div className="space-y-6">
      {/* file input global */}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFilePicked} />

      {/* Form crear en desplegable */}
      <details className="rounded-md border p-4">
        <summary className="cursor-pointer select-none text-sm font-medium">A\u00F1adir producto</summary>
        <div className="mt-3" />
        <div className="space-y-3">
          <div className="flex flex-col max-w-xl">
            <label className="text-sm text-gray-700">Nombre del producto</label>
            <input
              className="border rounded px-3 py-2 w-full"
              placeholder="Ej. Croqueta de jamón"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div className="flex flex-col max-w-xs">
            <label className="text-sm text-gray-700">Precio</label>
            <input
              className="border rounded px-3 py-2"
              placeholder="0.00"
              type="number"
              step="0.01"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col max-w-xl">
            <label className="text-sm text-gray-700">Categoría</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">Sin Categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
            <label className="text-sm text-gray-700">Imagen (opcional)</label>
          <div className="flex flex-col max-w-xl">
            <label className="text-sm text-gray-700">Imagen (opcional)</label>
            <input
              type="file"
              accept="image/*"
              className="border rounded px-3 py-2 w-full"
            />
          </div>
          <div className="flex flex-col max-w-xl">
            <label className="text-sm text-gray-700">Descripción (opcional)</label>
            <textarea
              className="border rounded px-3 py-2 w-full"
              rows={3}
              placeholder="Describe el producto"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
          </div>
          <span>Disponible</span>
        <label className="mt-3 inline-flex items-center gap-2">
          <input type="checkbox" checked={newAvail} onChange={(e) => setNewAvail(e.target.checked)} />
          <span>Disponible</span>
        </label>
          <button onClick={onCreate} disabled={loading} className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-60">
            AÃ±adir
          </button>
        </div>
      </details>

      {/* Filtros avanzados */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col">
          <label className="text-xs text-gray-600">Nombre</label>
          <input
            className="border rounded px-3 py-2 w-[220px]"
            placeholder="Buscar por nombre"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-600">Precio m\\u00E1x.\u00EDn.</label>
          <input
            type="number"
            step="0.01"
            className="border rounded px-3 py-2 w-[120px]"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value === "" ? "" : Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-600">Precio m\\u00E1x.¡x.</label>
          <input
            type="number"
            step="0.01"
            className="border rounded px-3 py-2 w-[120px]"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value === "" ? "" : Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-600">Disponible</label>
          <select className="border rounded px-3 py-2 w-[160px]" value={filterAvail} onChange={(e) => setFilterAvail(e.target.value as any)}>
            <option value="all">Todos</option>
            <option value="yes">SÃ­</option>
            <option value="no">No</option>
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-600">Categor\u00EDa</label>
          <select className="border rounded px-3 py-2 w-[200px]" value={filterCat} onChange={(e) => setFilterCat(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button onClick={resetFilters} className="h-[38px] rounded border px-3">Restablecer</button>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">Nombre</th>
              <th className="px-3 py-2 text-left">Precio</th>
              <th className="px-3 py-2 text-left">Disponible</th>
              <th className="px-3 py-2 text-left">Categor\u00EDa</th>
              <th className="px-3 py-2 text-left">Imagen</th>
              <th className="px-3 py-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {view.map((p) => {
              const isEditing = editingId === p.id;
              if (isEditing) {
                return (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-2">{p.id}</td>
                    <td className="px-3 py-2">
                      <input className="w-full rounded border px-2 py-1" value={editRow.name ?? ""} onChange={(e) => setEditRow((r) => ({ ...r, name: e.target.value }))} />
                      <div className="mt-1 text-xs text-gray-500">
                        <input className="w-full rounded border px-2 py-1" placeholder="DescripciÃ³n (opcional)" value={editRow.description ?? ""} onChange={(e) => setEditRow((r) => ({ ...r, description: e.target.value }))} />
                      </div>
                    </td>
                    <td className="w-[120px] px-3 py-2">
                      <input type="number" step="0.01" className="w-[110px] rounded border px-2 py-1" value={String(editRow.price ?? 0)} onChange={(e) => setEditRow((r) => ({ ...r, price: e.target.value === "" ? 0 : Number(e.target.value) }))} />
                    </td>
                    <td className="w-[110px] px-3 py-2">
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={!!editRow.available} onChange={(e) => setEditRow((r) => ({ ...r, available: e.target.checked }))} />
                        <span>{editRow.available ? "SÃ­" : "No"}</span>
                      </label>
                    </td>
                    <td className="w-[220px] px-3 py-2">
                      <select className="w-full rounded border px-2 py-1" value={editRow.category_id ?? ""} onChange={(e) => setEditRow((r) => ({ ...r, category_id: e.target.value === "" ? null : Number(e.target.value) }))}>
                        <option value="">Sin Categor\u00EDa</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">{p.image_url ? <img src={p.image_url} alt="" className="h-10 w-16 rounded object-cover" /> : <span className="text-gray-400">â€”</span>}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button onClick={saveEdit} disabled={loading} className="rounded bg-emerald-600 px-3 py-1 text-white disabled:opacity-60">
                          Guardar
                        </button>
                        <button onClick={cancelEdit} className="rounded bg-gray-200 px-3 py-1">Cancelar</button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2">{p.id}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{p.name}</div>
                    {p.description ? <div className="mt-1 text-xs text-gray-500">{p.description}</div> : null}
                  </td>
                  <td className="px-3 py-2">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(p.price))} â‚¬</td>
                  <td className="px-3 py-2">
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={p.available} onChange={(e) => toggleAvailable(p, e.target.checked)} />
                      <span>{p.available ? "SÃ­" : "No"}</span>
                    </label>
                  </td>
                  <td className="px-3 py-2">{p.category_id ? catById.get(p.category_id) ?? "â€”" : "â€”"}</td>
                  <td className="px-3 py-2">{p.image_url ? <img src={p.image_url} alt="" className="h-10 w-16 rounded object-cover" /> : <span className="text-gray-400">â€”</span>}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => startEdit(p)} className="rounded bg-blue-600 px-3 py-1 text-white">
                        Editar
                      </button>
                      <button onClick={() => triggerUpload(p.id)} className="rounded bg-gray-700 px-3 py-1 text-white">
                        Cambiar imagen
                      </button>
                      <button onClick={() => onDelete(p.id)} className="rounded bg-red-600 px-3 py-1 text-white">
                        Eliminar
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






