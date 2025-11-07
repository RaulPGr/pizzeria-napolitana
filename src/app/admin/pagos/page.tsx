"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAdminAccess } from "@/context/AdminAccessContext";

type Methods = { cash: boolean; card: boolean; bizum: boolean };

export default function AdminPaymentsPage() {
  const { plan, isSuper } = useAdminAccess();
  const limited = plan !== "premium" && !isSuper;
  if (limited) {
    return (
      <div className="rounded border border-amber-200 bg-amber-50 p-4 text-amber-800 shadow-sm">
        La configuracion de metodos de pago solo esta disponible en el plan Premium.
      </div>
    );
  }

  const [loading, setLoading] = useState(true);
  const [m, setM] = useState<Methods>({ cash: true, card: false, bizum: false });

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("settings")
        .select("allowed_payment_methods")
        .eq("id", 1)
        .single();
      if (data?.allowed_payment_methods) setM(data.allowed_payment_methods as Methods);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("settings")
      .update({ allowed_payment_methods: m, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setLoading(false);
    if (error) alert("No se pudo guardar");
    else alert("Guardado ok.");
  };

  return (
    <div className="mx-auto max-w-xl py-8">
      <h1 className="mb-6 text-2xl font-bold">Metodos de pago</h1>
      {loading ? (
        <p>Cargando...</p>
      ) : (
        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={m.cash}
              onChange={(e) => setM((v) => ({ ...v, cash: e.target.checked }))}
            />
            <span>Efectivo en tienda</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={m.card}
              onChange={(e) => setM((v) => ({ ...v, card: e.target.checked }))}
            />
            <span>Tarjeta (Stripe)</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={m.bizum}
              onChange={(e) => setM((v) => ({ ...v, bizum: e.target.checked }))}
            />
            <span>Bizum (Stripe)</span>
          </label>

          <button
            onClick={save}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            disabled={loading}
          >
            Guardar cambios
          </button>
          <p className="mt-4 text-sm text-gray-500">Nota: Bizum debe estar activado en tu cuenta de Stripe.</p>
        </div>
      )}
    </div>
  );
}
