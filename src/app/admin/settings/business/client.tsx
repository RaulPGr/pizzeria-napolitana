"use client";

import { useEffect, useState } from 'react';

type Biz = {
  id: string;
  slug: string;
  name: string;
  slogan: string | null;
  logo_url: string | null;
  hero_url: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address_line?: string | null;
  opening_hours?: any | null;
  social?: { instagram?: string | null; facebook?: string | null; tiktok?: string | null; web?: string | null } | null;
};

export default function BusinessSettingsClient() {
  const [biz, setBiz] = useState<Biz | null>(null);
  const [name, setName] = useState('');
  const [slogan, setSlogan] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [ohText, setOhText] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [web, setWeb] = useState('');
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
        setPhone(j.data.phone || '');
        setWhatsapp(j.data.whatsapp || '');
        setEmail(j.data.email || '');
        setAddress(j.data.address_line || '');
        try { setOhText(j.data.opening_hours ? JSON.stringify(j.data.opening_hours, null, 2) : ''); } catch { setOhText(''); }
        setInstagram(j.data.social?.instagram || '');
        setFacebook(j.data.social?.facebook || '');
        setTiktok(j.data.social?.tiktok || '');
        setWeb(j.data.social?.web || '');
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
        body: JSON.stringify({
          name,
          slogan,
          phone,
          whatsapp,
          email,
          address_line: address,
          social: { instagram, facebook, tiktok, web },
          opening_hours: ohText,
        }),
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm text-gray-700">Teléfono</label>
            <input className="border rounded px-3 py-2 w-full" value={phone} onChange={(e)=>setPhone(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-gray-700">WhatsApp</label>
            <input className="border rounded px-3 py-2 w-full" value={whatsapp} onChange={(e)=>setWhatsapp(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-gray-700">Email</label>
            <input type="email" className="border rounded px-3 py-2 w-full" value={email} onChange={(e)=>setEmail(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm text-gray-700">Dirección</label>
            <input className="border rounded px-3 py-2 w-full" value={address} onChange={(e)=>setAddress(e.target.value)} />
          </div>
        </div>

        <div className="grid gap-2">
          <div className="text-sm text-gray-700">Horarios (JSON)</div>
          <textarea className="border rounded px-3 py-2 w-full font-mono text-sm" rows={6} value={ohText} onChange={(e)=>setOhText(e.target.value)} placeholder='{"monday":[{"abre":"12:30","cierra":"16:00"}],"tuesday":[],...}' />
          <div className="text-xs text-gray-500">Consejo: puedes dejarlo vacío si aún no lo tienes listo. Ejemplo de estructura por días: monday, tuesday, … con [{`{"abre":"HH:MM","cierra":"HH:MM"}`}].</div>
        </div>

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

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm text-gray-700">Instagram</label>
            <input className="border rounded px-3 py-2 w-full" value={instagram} onChange={(e)=>setInstagram(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-gray-700">Facebook</label>
            <input className="border rounded px-3 py-2 w-full" value={facebook} onChange={(e)=>setFacebook(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-gray-700">TikTok</label>
            <input className="border rounded px-3 py-2 w-full" value={tiktok} onChange={(e)=>setTiktok(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-gray-700">Web</label>
            <input className="border rounded px-3 py-2 w-full" value={web} onChange={(e)=>setWeb(e.target.value)} />
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
