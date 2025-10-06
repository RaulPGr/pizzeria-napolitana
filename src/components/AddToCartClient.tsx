"use client";

import AddButtonWithFeedback from "@/components/AddButtonWithFeedback";

type Product = {
  id: number | string;
  nombre: string;
  precio: number;
  imagen?: string | null;
  stock?: number | null;
  activo?: boolean | null;
};

type Props = {
  product: Product;
  className?: string;
};

export default function AddToCartClient({ product, className = "" }: Props) {
  const disabled =
    (typeof product.stock === "number" && product.stock <= 0) ||
    product.activo === false;

  const handleAdd = async () => {
    // 1) Cargar carrito actual
    const raw = typeof window !== "undefined" ? localStorage.getItem("cart") : null;
    const state: any = raw ? JSON.parse(raw) : { items: [] as any[] };

    // 2) Añadir / incrementar
    const idx = state.items.findIndex((it: any) => it.id === product.id);
    if (idx >= 0) {
      state.items[idx].qty = (state.items[idx].qty || 1) + 1;
    } else {
      state.items.push({
        id: product.id,
        name: product.nombre,
        price: product.precio,
        qty: 1,
        image: product.imagen ?? null,
      });
    }

    // 3) Guardar + notificar (esto mantiene el numerito del carrito al día)
    localStorage.setItem("cart", JSON.stringify(state));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("cart_updated"));
    }
  };

  return (
    <AddButtonWithFeedback
      onAdd={handleAdd}
      disabled={disabled}
      className={className}
      label="Añadir"
      addedLabel="Añadido"
    />
  );
}
