"use client";

import { useEffect, useState } from 'react';

type DayKey = 'monday'|'tuesday'|'wednesday'|'thursday'|'friday'|'saturday'|'sunday';
type Tramo = { abre: string; cierra: string };
type OrderingHours = Partial<Record<DayKey, Tramo[]>>;

export default function OrdersHoursSettingsClient() {
  function getTenantFromUrl(): string {
    if (typeof window === 'undefined') return '';
    try { return new URLSearchParams(window.location.search).get('tenant') || ''; } catch { return ''; }
  }
  const [value, setValue] = useState<OrderingHours>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const t = getTenantFromUrl();
        const url = t ? `/api/admin/business?tenant=${encodeURIComponent(t)}` : '/api/admin/business';
        const r = await fetch(url, { cache: 'no-store' });
        const j = await r.json();
        if (j?.ok) {
          const raw = j.data?.ordering_hours;
          setValue((() => { try { return raw || {}; } catch { return {}; } })());
        }
      } catch {}
    })();
  }, []);

  async function save() {
    try {
      setSaving(true);
      setMsg(null);
      const t = getTenantFromUrl();
      const url = t ? `/api/admin/business?tenant=${encodeURIComponent(t)}` : '/api/admin/business';
      const r = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordering_hours: value && Object.keys(value).length ? value : '' }),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || 'Error');
      setMsg('Guardado');
    } catch (e: any) {
      setMsg(e?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Configura el horario en el que aceptas pedidos web. Si está vacío, se usan los horarios de apertura.
      </p>
      <HoursEditor value={value} onChange={setValue} />
      {msg && <div className="text-sm text-gray-700">{msg}</div>}
      <button onClick={() => void save()} disabled={saving} className="rounded bg-black px-4 py-2 text-white disabled:opacity-60">
        {saving ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </div>
  );
}

function HoursEditor({ value, onChange }: { value: OrderingHours; onChange: (v: OrderingHours)=>void }) {
  const days = [
    { key: 'monday', label: 'Lunes' },
    { key: 'tuesday', label: 'Martes' },
    { key: 'wednesday', label: 'Miércoles' },
    { key: 'thursday', label: 'Jueves' },
    { key: 'friday', label: 'Viernes' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' },
  ] as { key: DayKey; label: string }[];

  function updateDay(key: DayKey, tramos: Tramo[]) {
    const next: OrderingHours = { ...(value || {}) };
    if (!tramos || tramos.length === 0) {
      delete (next as any)[key];
    } else {
      (next as any)[key] = tramos;
    }
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3">
        {days.map((d) => {
          const tramos: Tramo[] = Array.isArray((value as any)?.[d.key]) ? (value as any)[d.key] : [];
          const setTramo = (i: number, field: 'abre'|'cierra', v: string) => {
            const arr = [...tramos];
            const base = arr[i] || { abre: '', cierra: '' };
            arr[i] = { ...base, [field]: v };
            updateDay(d.key, arr);
          };
          const addTramo = () => updateDay(d.key, [...tramos, { abre: '', cierra: '' }]);
          const delTramo = (i: number) => updateDay(d.key, tramos.filter((_, idx) => idx !== i));
          return (
            <div key={d.key} className="rounded border p-2">
              <div className="text-sm font-medium mb-2">{d.label}</div>
              {tramos.length === 0 && <div className="text-xs text-gray-500 mb-2">Cerrado</div>}
              <div className="space-y-2">
                {tramos.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="time" value={t.abre} onChange={(e)=>setTramo(i,'abre',e.target.value)} className="border rounded px-2 py-1" />
                    <span className="text-sm">a</span>
                    <input type="time" value={t.cierra} onChange={(e)=>setTramo(i,'cierra',e.target.value)} className="border rounded px-2 py-1" />
                    <button type="button" className="text-xs text-red-600" onClick={()=>delTramo(i)}>Quitar</button>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <button type="button" className="text-xs text-blue-600" onClick={addTramo}>Añadir tramo</button>
                {tramos.length>0 && <button type="button" className="text-xs text-gray-600" onClick={()=>updateDay(d.key, [])}>Vaciar</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
