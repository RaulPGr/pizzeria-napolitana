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
  const [about, setAbout] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<string>('');
  const [lng, setLng] = useState<string>('');
  const [hours, setHours] = useState<any>({});
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
        setAddress([j.data.address_line, j.data.postal_code, j.data.city].filter(Boolean).join(', '));
        if (j.data.lat != null) setLat(String(j.data.lat));
        if (j.data.lng != null) setLng(String(j.data.lng));
        setAbout(j.data.description || '');
        try { setHours(j.data.opening_hours || {}); } catch { setHours({}); }
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
          description: about,
          phone,
          whatsapp,
          email,
          address_line: address,
          lat: lat !== '' ? Number(lat) : null,
          lng: lng !== '' ? Number(lng) : null,
          social: { instagram, facebook, tiktok, web },
          opening_hours: (hours && Object.keys(hours).length ? hours : ''),
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
        <input className="border rounded px-3 py-2" placeholder="Pizzería napolitana" value={name} onChange={(e)=>setName(e.target.value)} />

        <label className="text-sm text-gray-700">Slogan</label>
        <input className="border rounded px-3 py-2" placeholder="La tradición de Nápoles en cada porción." value={slogan} onChange={(e)=>setSlogan(e.target.value)} />

        <label className="text-sm text-gray-700">Sobre nosotros</label>
        <textarea className="border rounded px-3 py-2 w-full" rows={4} value={about} onChange={(e)=>setAbout(e.target.value)} placeholder="Breve descripción del negocio" />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm text-gray-700">Teléfono</label>
            <input className="border rounded px-3 py-2 w-full" placeholder="+34 600 000 000" value={phone} onChange={(e)=>setPhone(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-gray-700">WhatsApp</label>
            <input className="border rounded px-3 py-2 w-full" placeholder="+34600000000" value={whatsapp} onChange={(e)=>setWhatsapp(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-gray-700">Email</label>
            <input type="email" className="border rounded px-3 py-2 w-full" placeholder="info@mirestaurante.com" value={email} onChange={(e)=>setEmail(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm text-gray-700">Dirección</label>
            <input className="border rounded px-3 py-2 w-full" placeholder="Calle Mayor 123, 30001 Murcia" value={address} onChange={(e)=>setAddress(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-gray-700">Latitud</label>
            <input className="border rounded px-3 py-2 w-full" placeholder="37.9861" value={lat} onChange={(e)=>setLat(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-gray-700">Longitud</label>
            <input className="border rounded px-3 py-2 w-full" placeholder="-1.1303" value={lng} onChange={(e)=>setLng(e.target.value)} />
          </div>
        </div>

        <HoursEditor value={hours} onChange={setHours} />

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

function HoursEditor({ value, onChange }: { value: any; onChange: (v:any)=>void }) {
  const days = [
    { key: 'monday', label: 'Lunes' },
    { key: 'tuesday', label: 'Martes' },
    { key: 'wednesday', label: 'Miércoles' },
    { key: 'thursday', label: 'Jueves' },
    { key: 'friday', label: 'Viernes' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' },
  ];

  function updateDay(key: string, tramos: Array<{abre:string;cierra:string}>) {
    const next = { ...(value || {}) };
    next[key] = tramos;
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Horarios</div>
      <div className="text-xs text-gray-500">Anade 0, 1 o 2 tramos por dia. Deja vacio para "Cerrado".</div>
      <div className="grid gap-3">
        {days.map(d => {
          const tramos: Array<{abre:string;cierra:string}> = Array.isArray(value?.[d.key]) ? value[d.key] : [];
          const setTramo = (i:number, field:'abre'|'cierra', v:string) => {
            const arr = [...tramos];
            const base = arr[i] || { abre:'', cierra:'' };
            arr[i] = { ...base, [field]: v };
            updateDay(d.key, arr);
          };
          const addTramo = () => updateDay(d.key, [...tramos, { abre:'', cierra:'' }]);
          const delTramo = (i:number) => updateDay(d.key, tramos.filter((_,idx)=>idx!==i));
          return (
            <div key={d.key} className="rounded border p-2">
              <div className="text-sm font-medium mb-2">{d.label}</div>
              {tramos.length === 0 && (
                <div className="text-xs text-gray-500 mb-2">Cerrado</div>
              )}
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

