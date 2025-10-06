"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

type OrderStatus = "pendiente" | "preparando" | "listo" | "entregado";

export default function OrderStatusClient({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as OrderStatus;

    startTransition(async () => {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        let msg = "No se pudo actualizar";
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {}
        alert(msg);
      }

      router.refresh();
    });
  }

  return (
    <select
      defaultValue={status}
      onChange={onChange}
      disabled={isPending}
      className="border rounded px-2 py-1 text-sm"
    >
      <option value="pendiente">pendiente</option>
      <option value="preparando">preparando</option>
      <option value="listo">listo</option>
      <option value="entregado">entregado</option>
    </select>
  );
}
