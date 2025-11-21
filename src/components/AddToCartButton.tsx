"use client";

import { useState } from "react";
import { addItem } from "@/lib/cart-storage";
import { useSubscriptionPlan } from "@/context/SubscriptionPlanContext";
import { useOrdersEnabled } from "@/context/OrdersEnabledContext";
import { subscriptionAllowsOrders } from "@/lib/subscription";

type Props = {
  product: { id: number | string; name: string; price: number; image_url?: string; category_id?: number | null };
  disabled?: boolean;
  disabledLabel?: string;
};

export default function AddToCartButton({ product, disabled, disabledLabel }: Props) {
  const plan = useSubscriptionPlan();
  const ordersEnabled = useOrdersEnabled();
  const planAllows = subscriptionAllowsOrders(plan);
  const allowOrdering = planAllows && ordersEnabled;
  const [busy, setBusy] = useState(false);

  async function onAdd() {
    if (disabled || busy || !allowOrdering) return;
    try {
      setBusy(true);
      addItem({ id: product.id, name: product.name, price: product.price, image: product.image_url, category_id: product.category_id }, 1);
    } finally {
      setBusy(false);
    }
  }

  const buttonDisabled = !!disabled || busy || !allowOrdering;
  const label = !allowOrdering
    ? (planAllows ? "Pedidos desactivados" : "No disponible en tu plan")
    : disabled
    ? (disabledLabel || "Agotado")
    : busy
    ? "Añadiendo..."
    : "Añadir";

  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={buttonDisabled}
      className={`mt-2 w-full rounded border px-3 py-1 text-sm ${
        buttonDisabled ? "opacity-50 cursor-not-allowed" : "bg-emerald-600 text-white hover:bg-emerald-700"
      }`}
    >
      {label}
    </button>
  );
}
