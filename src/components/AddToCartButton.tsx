"use client";

import { useState } from "react";
import { addItem } from "@/lib/cart-storage";
import { useSubscriptionPlan } from "@/context/SubscriptionPlanContext";

type Props = {
  product: { id: number | string; name: string; price: number; image_url?: string };
  disabled?: boolean;
  disabledLabel?: string;
};

export default function AddToCartButton({ product, disabled, disabledLabel }: Props) {
  const plan = useSubscriptionPlan();
  const allowOrdering = plan === "premium";
  const [busy, setBusy] = useState(false);

  async function onAdd() {
    if (disabled || busy || !allowOrdering) return;
    try {
      setBusy(true);
      addItem({ id: product.id, name: product.name, price: product.price, image: product.image_url }, 1);
    } finally {
      setBusy(false);
    }
  }

  const buttonDisabled = !!disabled || busy || !allowOrdering;
  const label = !allowOrdering
    ? "No disponible en tu plan"
    : disabled
    ? (disabledLabel || "Agotado")
    : busy
    ? "Anadiendo..."
    : "Anadir";

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
