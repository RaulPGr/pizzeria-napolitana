"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>("");
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({} as any));
      setErr(j?.error || "Error al iniciar sesión");
      return;
    }

    // cookies de sesión ya puestas por el API → redirigimos al admin
    router.replace("/admin");
  }

  return (
    <div className="min-h-screen px-4 py-12 flex items-center justify-center bg-gray-50">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm space-y-5"
      >
        <h1 className="text-center text-2xl font-semibold">Iniciar sesión</h1>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Correo electrónico</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
            autoComplete="email"
            className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {err && (
          <p className="text-center text-sm text-red-600">
            {err}
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded-md bg-emerald-600 py-2 text-white hover:bg-emerald-700 transition"
        >
          Entrar
        </button>

        <div className="text-center text-sm">
          <button
            type="button"
            onClick={async () => {
              try {
                setErr(null);
                if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
                  setErr("Introduce un email válido para enviar el enlace");
                  return;
                }
                // Forzamos el enlace al subdominio del negocio (evita que use un dominio de preview).
                const host = window.location.hostname;
                const parts = host.split(".");
                let redirectTo = `${window.location.origin}/auth/reset`;
                if (parts.length >= 3) {
                  const slug = parts[0];
                  redirectTo = `https://${slug}.pidelocal.es/auth/reset`;
                }
                const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
                if (error) throw error;
                setErr("Te hemos enviado un email para cambiar la contraseña");
              } catch (e: any) {
                setErr(e?.message || "No se pudo enviar el email");
              }
            }}
            className="mt-2 text-emerald-700 hover:underline"
          >
            Olvidé mi contraseña
          </button>
        </div>
      </form>
    </div>
  );
}
