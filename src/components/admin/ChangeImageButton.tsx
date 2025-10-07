'use client';

import { useState } from 'react';

type Props = {
  id: number;
  currentUrl?: string | null;
  onDone?: () => void; // refrescar lista si quieres
};

export default function ChangeImageButton({ id, currentUrl, onDone }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    const url = window.prompt(
      'Pega la URL de la imagen (https://...)\nDeja vacío para borrar la imagen:',
      currentUrl || ''
    );
    if (url === null) return; // cancelado

    try {
      setLoading(true);
      const res = await fetch('/api/products/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, image_url: url || null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(`No se pudo actualizar la imagen.\n${j?.error || res.statusText}`);
        return;
      }
      onDone?.();
    } catch (e: any) {
      alert(`Error de red: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="rounded border px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      title="Cambiar URL de imagen"
    >
      {loading ? 'Guardando…' : 'Cambiar imagen'}
    </button>
  );
}
