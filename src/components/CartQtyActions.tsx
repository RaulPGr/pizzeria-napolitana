"use client";

import { useEffect, useState } from "react";
import { addItem, removeItem, setQty, subscribe, CartItem } from "@/lib/cart-storage";
import { useSubscriptionPlan } from "@/context/SubscriptionPlanContext";
import { useOrdersEnabled } from "@/context/OrdersEnabledContext";
import { subscriptionAllowsOrders } from "@/lib/subscription";

type Props = {
  productId: number | string;
  allowAdd?: boolean;
  variantKey?: string | null;
};

export default function CartQtyActions({ productId, allowAdd = true, variantKey }: Props) {
  const plan = useSubscriptionPlan();
  const ordersEnabled = useOrdersEnabled();
  const allowOrdering = subscriptionAllowsOrders(plan) && ordersEnabled;
  const [qty, setLocalQty] = useState(0);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!allowOrdering) {
      setLocalQty(0);
      return;
    }
    return subscribe((items: CartItem[]) => {
      const it = items.find(
        (x) => String(x.id) === String(productId) && String(x.variantKey || "") === String(variantKey || "")
      );
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
  }, [allowOrdering, productId]);

  if (!allowOrdering || !qty) return null;

  function dec() {
    const next = Math.max(0, qty - 1);
    if (next === 0) removeItem(productId, variantKey || undefined);
    else setQty(productId, next, variantKey || undefined);
  }
  function inc() {
    if (!allowAdd) return;
    addItem({ id: productId, variantKey: variantKey || undefined }, 1);
  }
  function clear() {
    removeItem(productId, variantKey || undefined);
  }

  return (
    <div className="absolute right-2 top-2 flex items-center gap-1">
      <button
        type="button"
        onClick={dec}
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border bg-white ${
          qty === 1 ? "border-red-500 text-red-600 hover:bg-red-50" : "text-gray-700 hover:bg-gray-100"
        }`}
        title={qty === 1 ? "Eliminar todas" : "Quitar 1"}
        aria-label={qty === 1 ? "Eliminar todas" : "Quitar 1"}
      >
        -
      </button>
      <span
        className={`inline-flex min-w-[22px] items-center justify-center rounded-full bg-emerald-600 px-1.5 py-0.5 text-[11px] font-semibold text-white shadow transition-transform duration-150 ${
          pulse ? "scale-110" : "scale-100"
        }`}
      >
        {qty}
      </span>
      <button
        type="button"
        onClick={inc}
        disabled={!allowAdd}
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border bg-white text-gray-700 ${
          allowAdd ? "hover:bg-gray-100" : "opacity-50 cursor-not-allowed"
        }`}
        title={allowAdd ? "Añadir 1" : "No disponible hoy"}
        aria-label={allowAdd ? "Añadir 1" : "No disponible hoy"}
      >
        +
      </button>
      <button
        type="button"
        onClick={clear}
        className="ml-1 inline-flex h-5 items-center justify-center rounded-full border border-transparent bg-white px-1 text-[10px] text-gray-500 hover:border-gray-300"
        title="Vaciar producto"
        aria-label="Vaciar producto"
      >
        ✕
      </button>
    </div>
  );
}
