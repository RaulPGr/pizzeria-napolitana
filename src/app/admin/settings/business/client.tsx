"use client";

import { useEffect, useState } from 'react';

type Biz = {
  id: string;
  slug: string;
  name: string;
  slogan: string | null;
  logo_url: string | null;
  hero_url: string | null;
};

export default function BusinessSettingsClient() {
  const [biz, setBiz] = useState<Biz | null>(null);
  const [name, setName] = useState('');
  const [slogan, setSlogan] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/admin/business', { cache: 'no-store' });
      const j = await r.json();
      if (j?.ok) {
        setBiz(j.data);
        setName(j.data.name || '');
        setSlogan(j.data.slogan || '');
      } else {
        setMsg(j?.error || 'No se pudo cargar la configuración');
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch('/api/admin/business', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slogan }),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || 'Error');
      setMsg('Guardado correctamente');
    } catch (e: any) {
      setMsg(e?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function upload(kind: 'logo'|'hero', file: File) {
    const fd = new FormData();
    fd.append('type', kind);
    fd.append('file', file);
    const r = await fetch('/api/admin/business', { method: 'POST', body: fd });
    const j = await r.json();
    if (!j?.ok) throw new Error(j?.error || 'Error subiendo');
    setBiz((b) => b ? { ...b, [kind + '_url' as any]: j.url } as any : b);
  }

  return (
    <div className="space-y-6 rounded-lg border bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold">Configuración del negocio</h2>
        <p className="text-sm text-gray-600">Nombre, eslogan y logotipos que verán tus clientes.</p>
      </div>

      {msg && (
        <div className="rounded border p-2 text-sm" style={{ borderColor:'#cbd5e1', background:'#f8fafc' }}>{msg}</div>
      )}

      <div className="grid gap-4">
        <label className="text-sm text-gray-700">Nombre comercial</label>
        <input className="border rounded px-3 py-2" value={name} onChange={(e)=>setName(e.target.value)} />

        <label className="text-sm text-gray-700">Slogan</label>
        <input className="border rounded px-3 py-2" value={slogan} onChange={(e)=>setSlogan(e.target.value)} />

        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <div className="text-sm text-gray-700 mb-1">Logo</div>
            {biz?.logo_url && <img src={biz.logo_url} alt="logo" className="h-16 w-auto rounded border mb-2" />}
            <input type="file" accept="image/*" onChange={(e)=>{ const f=e.target.files?.[0]; if(f) upload('logo', f).catch(err=>setMsg(err.message)); }} />
          </div>
          <div>
            <div className="text-sm text-gray-700 mb-1">Imagen de cabecera</div>
            {biz?.hero_url && <img src={biz.hero_url} alt="hero" className="h-24 w-full object-cover rounded border mb-2" />}
            <input type="file" accept="image/*" onChange={(e)=>{ const f=e.target.files?.[0]; if(f) upload('hero', f).catch(err=>setMsg(err.message)); }} />
          </div>
        </div>

        <div>
          <button onClick={()=>void save()} disabled={saving} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-60">
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

