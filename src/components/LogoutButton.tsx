"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Botón minimalista usado en el admin para cerrar sesión con fetch /api/logout.
export default function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  // Limpia la sesión del panel y redirige al login.
  async function onLogout() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/logout", { method: "POST", headers: { "Cache-Control": "no-store" } });
    } catch {}
    setBusy(false);
    router.replace("/login");
  }

  return (
    <button
      onClick={onLogout}
      disabled={busy}
      className="inline-flex items-center rounded-full border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-60"
      title="Cerrar sesión"
      type="button"
    >
      {busy ? "Saliendo…" : "Cerrar sesión"}
    </button>
  );
}
