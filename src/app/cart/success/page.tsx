"use client";

import { useEffect, useState } from "react";

export default function CartSuccessPage() {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [msg, setMsg] = useState("Confirmando pago...");

  useEffect(() => {
    async function finalize() {
      const sp = new URLSearchParams(window.location.search);
      const session_id = sp.get("session_id");

      if (!session_id) {
        setStatus("error");
        setMsg("Falta session_id en la URL.");
        return;
      }

      try {
        const res = await fetch(`/api/orders/card/finalize?session_id=${encodeURIComponent(session_id)}`, {
          method: "POST",
        });

        if (!res.ok) {
          const j = await res.json().catch(() => ({} as any));
          throw new Error(j?.error || `HTTP ${res.status}`);
        }

        // limpiar carrito en cliente
        try {
          localStorage.removeItem("cart");
          localStorage.removeItem("cart_items");
          window.dispatchEvent(new Event("cart_updated"));
        } catch {}

        setStatus("ok");
        setMsg("¡Pago confirmado y pedido creado correctamente!");
      } catch (e: any) {
        setStatus("error");
        setMsg(`No se pudo confirmar el pago: ${e?.message || "Error"}`);
      }
    }

    finalize();
  }, []);

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Pago con tarjeta</h1>
      <div
        className={`rounded-md p-4 ${
          status === "ok"
            ? "bg-green-50 text-green-800"
            : status === "error"
            ? "bg-red-50 text-red-800"
            : "bg-blue-50 text-blue-800"
        }`}
      >
        {msg}
      </div>
      {status !== "loading" && (
        <a
          href="/menu"
          className="inline-block mt-6 px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
        >
          Volver al menú
        </a>
      )}
    </main>
  );
}
