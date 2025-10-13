"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

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

