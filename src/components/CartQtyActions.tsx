"use client";

import { addItem, removeItem, setQty, subscribe, CartItem } from "@/lib/cart-storage";
import { useEffect, useState } from "react";

type Props = {
  productId: number | string;
  allowAdd?: boolean; // si false, desactiva el botón + (añadir)
};

export default function CartQtyActions({ productId, allowAdd = true }: Props) {
  const [qty, setLocalQty] = useState(0);

  useEffect(() => {
    return subscribe((items: CartItem[]) => {
      const it = items.find((x) => String(x.id) === String(productId));
      setLocalQty(it?.qty ?? 0);
    });
  }, [productId]);

  if (!qty) return null;

  function dec() {
    const next = Math.max(0, qty - 1);
    if (next === 0) removeItem(productId);
    else setQty(productId, next);
  }
  function inc() {
    if (!allowAdd) return;
    addItem({ id: productId }, 1);
  }
  function clear() {
    removeItem(productId);
  }

  return (
    <div className="absolute right-2 top-2 flex items-center gap-1">
      <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-emerald-600 px-1.5 py-0.5 text-[11px] font-semibold text-white shadow">
        {qty}
      </span>
      <button
        type="button"
        onClick={dec}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border bg-white text-gray-700 hover:bg-gray-100"
        title="Quitar 1"
        aria-label="Quitar 1"
      >
        −
      </button>
      <button
        type="button"
        onClick={clear}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border bg-white text-gray-700 hover:bg-gray-100"
        title="Eliminar del carrito"
        aria-label="Eliminar del carrito"
      >
        ×
      </button>
      {allowAdd && (
        <button
          type="button"
          onClick={inc}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border bg-white text-gray-700 hover:bg-gray-100"
          title="Añadir 1"
          aria-label="Añadir 1"
        >
          +
        </button>
      )}
    </div>
  );
}

