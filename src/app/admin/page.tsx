// /src/app/admin/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Producto = {
  id: number;
  nombre: string;
  precio: number;
  descripcion: string;
  imagen: string;
  categoria: string;
  stock: number;       // 0 = agotado, >0 = disponible
  activo?: boolean | null;
};

export default function AdminPage() {
  const router = useRouter();

  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [imagen, setImagen] = useState<File | null>(null);
  const [categoria, setCategoria] = useState("");
  const [productos, setProductos] = useState<Producto[]>([]);

  const [modoEdicion, setModoEdicion] = useState(false);
  const [productoEditando, setProductoEditando] = useState<Producto | null>(null);

  const categorias = ["Entrantes", "Platos principales", "Postres", "Bebidas"];

  // 🔐 Verificación de sesión al cargar
  useEffect(() => {
    const verificarSesion = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) router.push("/login");
      else cargarProductos();
    };
    verificarSesion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarProductos() {
    const { data, error } = await supabase
      .from("productos")
      .select("*")
      .order("categoria", { ascending: true })
      .order("nombre", { ascending: true });

    if (error) {
      console.error("Error cargando productos:", error);
      return;
    }
    setProductos((data || []) as Producto[]);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let urlImagen = productoEditando?.imagen || "";

    if (imagen) {
      const nombreArchivo = `${Date.now()}-${imagen.name}`;
      const { error: uploadError } = await supabase.storage
        .from("productos")
        .upload(nombreArchivo, imagen);

      if (uploadError) {
        alert("Error al subir la imagen");
        console.error("Detalles del error al subir la imagen:", uploadError);
        return;
      }

      urlImagen = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/productos/${nombreArchivo}`;
    }

    if (modoEdicion && productoEditando) {
      const { error } = await supabase
        .from("productos")
        .update({
          nombre,
          precio: parseFloat(precio),
          descripcion,
          imagen: urlImagen,
          categoria,
        })
        .eq("id", productoEditando.id);

      if (error) {
        alert("Error al actualizar producto");
        return;
      }
      alert("Producto actualizado ✅");
    } else {
      const { error } = await supabase.from("productos").insert({
        nombre,
        precio: parseFloat(precio),
        descripcion,
        imagen: urlImagen,
        categoria,
        stock: 1, // 👈 por defecto disponible
      });

      if (error) {
        alert("Error al agregar producto");
        return;
      }
      alert("Producto agregado ✅");
    }

    // reset
    setNombre("");
    setPrecio("");
    setDescripcion("");
    setImagen(null);
    setCategoria("");
    setModoEdicion(false);
    setProductoEditando(null);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    if (fileInput) fileInput.value = "";
    cargarProductos();
  };

  const prepararEdicion = (producto: Producto) => {
    setModoEdicion(true);
    setProductoEditando(producto);
    setNombre(producto.nombre);
    setPrecio(String(producto.precio));
    setDescripcion(producto.descripcion);
    setCategoria(producto.categoria || "");
  };

  const eliminarProducto = async (id: number, imageUrl: string) => {
    const confirmar = confirm("¿Seguro que deseas eliminar este producto?");
    if (!confirmar) return;

    const { error: deleteErrorDb } = await supabase.from("productos").delete().eq("id", id);
    if (deleteErrorDb) {
      console.error("Error eliminando de DB:", deleteErrorDb.message);
      return;
    }

    // borrar imagen del storage (best effort)
    try {
      if (imageUrl) {
        const url = new URL(imageUrl);
        const pathname = decodeURIComponent(url.pathname);
        const nombreArchivo = pathname.split("/").pop();
        const ruta = `productos/${nombreArchivo}`;
        const { error: deleteErrorStorage } = await supabase.storage.from("productos").remove([ruta]);
        if (deleteErrorStorage) {
          console.warn("No se pudo borrar imagen del storage:", deleteErrorStorage.message);
        }
      }
    } catch (e) {
      console.warn("No se pudo procesar la ruta de la imagen:", e);
    }

    cargarProductos();
  };

  // 👇 Toggle Agotado/Disponible (stock 0/1)
  const toggleStock = async (p: Producto) => {
    const nuevoStock = p.stock > 0 ? 0 : 1;
    const { error } = await supabase
      .from("productos")
      .update({ stock: nuevoStock })
      .eq("id", p.id);

    if (error) {
      alert("No se pudo actualizar el stock");
      console.error(error);
      return;
    }
    cargarProductos();
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Panel de Administración</h1>

      <form onSubmit={handleSubmit} className="space-y-4 mb-10">
        <input
          className="w-full border p-2 rounded"
          type="text"
          placeholder="Nombre del producto"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />
        <input
          className="w-full border p-2 rounded"
          type="number"
          step="0.01"
          placeholder="Precio (€)"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          required
        />
        <textarea
          className="w-full border p-2 rounded"
          placeholder="Descripción"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          required
        />
        <select
          className="w-full border p-2 rounded"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          required
        >
          <option value="">Selecciona una categoría</option>
          {categorias.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <input
          className="w-full border p-2 rounded"
          type="file"
          accept="image/*"
          onChange={(e) => {
            if (e.target.files?.[0]) setImagen(e.target.files[0]);
          }}
        />

        <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          {modoEdicion ? "Actualizar producto" : "Agregar producto"}
        </button>
      </form>

      <h2 className="text-xl font-semibold mb-3">Productos existentes:</h2>
      <ul className="space-y-2">
        {productos.map((p) => (
          <li
            key={p.id}
            className="border p-3 rounded flex justify-between items-center gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <img
                  src={p.imagen}
                  alt={p.nombre}
                  className="w-16 h-16 object-cover rounded"
                />
                {p.stock === 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded">
                    Agotado
                  </span>
                )}
              </div>
              <div>
                <div className="font-semibold">{p.nombre}</div>
                <div className="text-sm text-gray-600">{p.categoria}</div>
                <div className="text-sm">{p.precio.toFixed(2)} €</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`text-xs px-2 py-1 rounded border ${
                  p.stock > 0
                    ? "bg-green-50 text-green-700 border-green-300"
                    : "bg-red-50 text-red-700 border-red-300"
                }`}
                title="Estado de disponibilidad"
              >
                {p.stock > 0 ? "Disponible" : "Agotado"}
              </span>

              <button
                onClick={() => toggleStock(p)}
                className={`px-3 py-1 rounded border ${
                  p.stock > 0
                    ? "text-red-600 border-red-300 hover:bg-red-50"
                    : "text-green-700 border-green-300 hover:bg-green-50"
                }`}
              >
                {p.stock > 0 ? "Agotar" : "Poner disponible"}
              </button>

              <button
                onClick={() => prepararEdicion(p)}
                className="text-blue-600 hover:underline"
              >
                Editar
              </button>
              <button
                onClick={() => eliminarProducto(p.id, p.imagen)}
                className="text-red-600 hover:underline"
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
