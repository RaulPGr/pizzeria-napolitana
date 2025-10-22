"use client";

import { subscribe, CartItem } from "@/lib/cart-storage";
import { useEffect, useState } from "react";

export default function CartQtyBadge({ productId }: { productId: number | string }) {
  const [qty, setQty] = useState(0);

  useEffect(() => {
    return subscribe((items: CartItem[]) => {
      const it = items.find((x) => String(x.id) === String(productId));
      setQty(it?.qty ?? 0);
    });
  }, [productId]);

  if (!qty) return null;

  return (
    <span
      className="absolute right-2 top-2 inline-flex min-w-[22px] items-center justify-center rounded-full bg-emerald-600 px-1.5 py-0.5 text-[11px] font-semibold text-white shadow"
      aria-label={`En el carrito: ${qty}`}
      title={`En el carrito: ${qty}`}
    >
      {qty}
    </span>
  );
}

