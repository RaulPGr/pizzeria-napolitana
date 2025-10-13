"use client";

import { addItem } from "@/lib/cart-storage";
import { useState } from "react";

type Props = {
  product: { id: number | string; name: string; price: number; image_url?: string };
  disabled?: boolean;
};

export default function AddToCartButton({ product, disabled }: Props) {
  const [busy, setBusy] = useState(false);

  async function onAdd() {
    if (disabled || busy) return;
    try {
      setBusy(true);
      addItem({ id: product.id, name: product.name, price: product.price, image: product.image_url }, 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={!!disabled || busy}
      className={`mt-2 w-full rounded border px-3 py-1 text-sm ${
        disabled ? "opacity-50 cursor-not-allowed" : "bg-emerald-600 text-white hover:bg-emerald-700"
      }`}
    >
      {disabled ? "Agotado" : busy ? "Añadiendo..." : "Añadir"}
    </button>
  );
}

