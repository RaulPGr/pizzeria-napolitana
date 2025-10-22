"use client";

import { addItem, removeItem, setQty, subscribe, CartItem } from "@/lib/cart-storage";
import { useEffect, useState } from "react";

type Props = {
  productId: number | string;
  allowAdd?: boolean; // si false, desactiva el botón + (añadir)
};

export default function CartQtyActions({ productId, allowAdd = true }: Props) {
  const [qty, setLocalQty] = useState(0);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    return subscribe((items: CartItem[]) => {
      const it = items.find((x) => String(x.id) === String(productId));
      const next = it?.qty ?? 0;
      setLocalQty((prev) => {
        if (prev !== next) {
          try {
            setPulse(true);
            setTimeout(() => setPulse(false), 180);
          } catch {}
        }
        return next;
      });
    });
  }, [productId]);

  if (!qty) return null;

  function dec() {
    // Si hay 1 unidad y resta, se eliminan todas (qty -> 0)
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
      <button
        type="button"
        onClick={dec}
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border bg-white ${qty === 1 ? 'border-red-500 text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-100'}`}
        title={qty === 1 ? 'Eliminar todas' : 'Quitar 1'}
        aria-label={qty === 1 ? 'Eliminar todas' : 'Quitar 1'}
      >
        −
      </button>
      <span
        className={`inline-flex min-w-[22px] items-center justify-center rounded-full bg-emerald-600 px-1.5 py-0.5 text-[11px] font-semibold text-white shadow transition-transform duration-150 ${pulse ? 'scale-110' : 'scale-100'}`}
      >
        {qty}
      </span>
      <button
        type="button"
        onClick={inc}
        disabled={!allowAdd}
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border bg-white text-gray-700 ${allowAdd ? 'hover:bg-gray-100' : 'opacity-50 cursor-not-allowed'}`}
        title={allowAdd ? 'Añadir 1' : 'No disponible hoy'}
        aria-label={allowAdd ? 'Añadir 1' : 'No disponible hoy'}
      >
        +
      </button>
    </div>
  );
}
