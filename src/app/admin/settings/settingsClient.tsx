"use client";

import { useEffect, useState } from 'react';

type Config = { cash: boolean; card: boolean };

// Formulario para activar/desactivar métodos de pago visibles en el carrito.
export default function SettingsClient() {
  const [cfg, setCfg] = useState<Config>({ cash: true, card: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings/payments', { cache: 'no-store' });
        const j = await res.json();
        if (j?.ok && j?.data) setCfg({ cash: !!j.data.cash, card: !!j.data.card });
      } catch {}
    })();
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) throw new Error(j?.message || 'Error guardando');
      alert('Configuración guardada');
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 rounded-lg border bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold">Configuración de pagos</h2>
        <p className="text-sm text-gray-600">Selecciona los métodos que verán los clientes en el carrito.</p>
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={cfg.cash} onChange={(e) => setCfg((c) => ({ ...c, cash: e.target.checked }))} />
          <span>Pago en tienda</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={cfg.card} onChange={(e) => setCfg((c) => ({ ...c, card: e.target.checked }))} />
          <span>Tarjeta</span>
        </label>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>}

      <div>
        <button onClick={() => void save()} disabled={saving} className="rounded bg-black px-4 py-2 text-white disabled:opacity-60">
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
