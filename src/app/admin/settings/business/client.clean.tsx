"use client";

import { ReactNode, useEffect, useState } from 'react';
import { useAdminAccess } from "@/context/AdminAccessContext";
import { subscriptionAllowsReservations, subscriptionAllowsOrders } from "@/lib/subscription";

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
  menu_mode?: 'fixed' | 'daily';
  menu_layout?: 'cards' | 'list' | null;
};

export default function BusinessSettingsClient() {
  const { plan } = useAdminAccess();
  const canManageReservations = subscriptionAllowsReservations(plan);
  const canManageOrders = subscriptionAllowsOrders(plan);
  function getTenantFromUrl(): string {
     if (typeof window === 'undefined') return '';
     try {
       return new URLSearchParams(window.location.search).get('tenant') || '';
     } catch {
       return '';
     }
   }

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
  const [notifyOrders, setNotifyOrders] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [ordersEnabled, setOrdersEnabled] = useState(true);
   const [reservationsEnabled, setReservationsEnabled] = useState(false);
   const [reservationsEmail, setReservationsEmail] = useState('');
   const [reservationsCapacity, setReservationsCapacity] = useState<number>(0);
   const [instagram, setInstagram] = useState('');
   const [facebook, setFacebook] = useState('');
   const [tiktok, setTiktok] = useState('');
   const [web, setWeb] = useState('');
   const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [menuMode, setMenuMode] = useState<'fixed' | 'daily'>('fixed');
  const [menuLayout, setMenuLayout] = useState<'cards' | 'list'>('cards');
 
  useEffect(() => {
    (async () => {
      const t = getTenantFromUrl();
      const url = t ? `/api/admin/business?tenant=${encodeURIComponent(t)}` : '/api/admin/business';
      const r = await fetch(url, { cache: 'no-store' });
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
        try {
          setHours(j.data.opening_hours || {});
        } catch {
          setHours({});
        }
        setNotifyOrders(Boolean(j.data.notify_orders_enabled));
        setOrdersEnabled(j.data.orders_enabled !== false);
        setNotifyEmail(j.data.notify_orders_email || j.data.email || '');
        setReservationsEnabled(Boolean(j.data.reservations_enabled));
        setReservationsEmail(j.data.reservations_email || j.data.email || '');
        const cap = Number(j.data.reservations_capacity ?? 0);
        setReservationsCapacity(Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : 0);
        setInstagram(j.data.social?.instagram || '');
        setFacebook(j.data.social?.facebook || '');
        setTiktok(j.data.social?.tiktok || '');
        setWeb(j.data.social?.web || '');
        setMenuMode((j.data.menu_mode as 'fixed' | 'daily') || 'fixed');
        setMenuLayout((j.data.menu_layout as 'cards' | 'list') === 'list' ? 'list' : 'cards');
      } else {
        setMsg(j?.error || 'No se pudo cargar la configuracion');
      }
    })();
  }, []);
 
  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const t = getTenantFromUrl();
      const url = t ? `/api/admin/business?tenant=${encodeURIComponent(t)}` : '/api/admin/business';
      const r = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slogan,
          description: about,
          phone,
          whatsapp,
          email,
        notify_orders_enabled: notifyOrders,
        notify_orders_email: notifyEmail || null,
        orders_enabled: ordersEnabled,
        reservations_enabled: reservationsEnabled,
          reservations_email: reservationsEmail || null,
          reservations_capacity: reservationsCapacity,
          address_line: address,
          lat: lat !== '' ? Number(lat) : null,
          lng: lng !== '' ? Number(lng) : null,
          social: { instagram, facebook, tiktok, web },
          opening_hours: hours && Object.keys(hours).length ? hours : '',
          menu_mode: menuMode,
          menu_layout: menuLayout,
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
 
  async function upload(kind: 'logo' | 'hero', file: File) {
    const fd = new FormData();
    fd.append('type', kind);
    fd.append('file', file);
    const t = getTenantFromUrl();
    const url = t ? `/api/admin/business?tenant=${encodeURIComponent(t)}` : '/api/admin/business';
    const r = await fetch(url, { method: 'POST', body: fd });
    const j = await r.json();
    if (!j?.ok) throw new Error(j?.error || 'Error subiendo');
    setBiz((b) => (b ? ({ ...b, [`${kind}_url`]: j.url } as Biz) : b));
  }
 
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-slate-900">Configuracion del negocio</h2>
        <p className="text-sm text-slate-600">
          Organiza los datos que se muestran en tu pagina y como recibes avisos.
        </p>
      </header>
 
      {msg && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {msg}
        </div>
      )}
 
      <div className="space-y-6">
        <Section
          title="Datos generales"
          description="Edita la informacion principal que veran tus clientes."
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Nombre comercial</label>
            <input
              className="w-full rounded border border-slate-200 px-3 py-2"
              placeholder="Pizzeria napolitana"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
 
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Slogan</label>
              <input
                className="w-full rounded border border-slate-200 px-3 py-2"
                placeholder="La tradicion de Napoles en cada porcion."
                value={slogan}
                onChange={(e) => setSlogan(e.target.value)}
              />
            </div>
 
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Sobre nosotros</label>
              <textarea
                className="w-full rounded border border-slate-200 px-3 py-2"
                rows={4}
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="Breve descripcion del negocio"
              />
            </div>
 
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-700">Tipo de menu</legend>
              <div className="flex flex-wrap items-center gap-6 text-sm text-slate-700">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="menu_mode"
                    value="fixed"
                    checked={menuMode === 'fixed'}
                    onChange={() => setMenuMode('fixed')}
                  />
                  <span>Menu fijo</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="menu_mode"
                    value="daily"
                    checked={menuMode === 'daily'}
                    onChange={() => setMenuMode('daily')}
                  />
                  <span>Menu por dias</span>
                </label>
              </div>
              <p className="text-xs text-slate-500">
                Fijo: el catalogo funciona como ahora. Por dias: al crear productos podras marcar los dias
                disponibles y el menu publico mostrara pestanas L-D.
              </p>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-slate-700">Diseno de la carta</legend>
              <p className="text-xs text-slate-500">
                Elige si quieres mostrar productos con tarjetas con foto o en un listado compacto sin imagenes.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label
                  className={`flex items-start gap-3 rounded border px-3 py-2 text-sm ${
                    menuLayout === 'cards' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="menu_layout"
                    value="cards"
                    checked={menuLayout === 'cards'}
                    onChange={() => setMenuLayout('cards')}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-medium">Con imagenes</span>
                    <span className="text-xs text-slate-500">Diseno actual con tarjetas y foto de cada producto.</span>
                  </span>
                </label>
                <label
                  className={`flex items-start gap-3 rounded border px-3 py-2 text-sm ${
                    menuLayout === 'list' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="menu_layout"
                    value="list"
                    checked={menuLayout === 'list'}
                    onChange={() => setMenuLayout('list')}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-medium">Listado compacto</span>
                    <span className="text-xs text-slate-500">
                      Agrupa por categoria y muestra los productos en filas sin imagen, ideal para cartas extensas.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>
        </Section>

        <Section
          title="Contacto y ubicacion"
          description="Datos de contacto y coordenadas para el mapa."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Telefono</label>
              <input
                className="w-full rounded border border-slate-200 px-3 py-2"
                  placeholder="+34 600 000 000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">WhatsApp</label>
                <input
                  className="w-full rounded border border-slate-200 px-3 py-2"
                  placeholder="+34600000000"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  className="w-full rounded border border-slate-200 px-3 py-2"
                  placeholder="info@mirestaurante.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Direccion</label>
                <input
                  className="w-full rounded border border-slate-200 px-3 py-2"
                  placeholder="Calle Mayor 123, 30001 Murcia"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Latitud</label>
                <input
                  className="w-full rounded border border-slate-200 px-3 py-2"
                  placeholder="37.9861"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Longitud</label>
                <input
                  className="w-full rounded border border-slate-200 px-3 py-2"
                  placeholder="-1.1303"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                />
              </div>
            </div>
        </Section>

        <Section
          title="Horarios"
          description="Configura aperturas y cierres para cada dia."
        >
          <HoursEditor value={hours} onChange={setHours} />
        </Section>

        {canManageOrders && (
          <Section
            title="Pedidos online"
            description="Activa o desactiva temporalmente la recepción de pedidos en la web."
          >
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={ordersEnabled}
                onChange={(e) => setOrdersEnabled(e.target.checked)}
              />
              <span>Permitir pedidos online</span>
            </label>
            {!ordersEnabled && (
              <p className="text-xs text-slate-500">
                Mientras esté desactivado ocultaremos el carrito y los botones “Añadir” aunque sigas en plan Premium.
              </p>
            )}
          </Section>
        )}

        {canManageOrders && (
          <Section
            title="Notificaciones por correo"
            description="Recibe avisos cuando entre un pedido nuevo."
          >
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={notifyOrders}
                onChange={(e) => setNotifyOrders(e.target.checked)}
              />
              <span>Recibir notificaciones por email</span>
            </label>
            {notifyOrders && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Email donde recibir los avisos</label>
                <input
                  className="w-full rounded border border-slate-200 px-3 py-2"
                  type="email"
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                  placeholder="correo@negocio.com"
                />
                <p className="text-xs text-slate-500">
                  Si lo dejas vacio usaremos el email principal del negocio.
                </p>
              </div>
            )}
          </Section>
        )}

        {canManageReservations && (
          <Section
            title="Reservas de mesa"
            description="Permite que tus clientes soliciten una reserva desde la web."
          >
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={reservationsEnabled}
                onChange={(e) => setReservationsEnabled(e.target.checked)}
              />
              <span>Activar formulario de reservas</span>
            </label>
            {reservationsEnabled && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Capacidad por franja</label>
                  <input
                    className="w-full rounded border border-slate-200 px-3 py-2"
                    type="number"
                    min={0}
                    max={50}
                    value={reservationsCapacity}
                    onChange={(e) =>
                      setReservationsCapacity(Math.max(0, Math.floor(Number(e.target.value) || 0)))
                    }
                  />
                  <p className="text-xs text-slate-500">Pon 0 para ilimitadas.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Email para recibir reservas</label>
                  <input
                    className="w-full rounded border border-slate-200 px-3 py-2"
                    type="email"
                    value={reservationsEmail}
                    onChange={(e) => setReservationsEmail(e.target.value)}
                    placeholder="reservas@negocio.com"
                  />
                  <p className="text-xs text-slate-500">
                    Si lo dejas vacio usaremos el email principal del negocio.
                  </p>
                </div>
              </div>
            )}
          </Section>
        )}

        <Section
          title="Imagenes"
          description="Sube el logotipo y la imagen de cabecera."
        >
          <div className="grid gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Logo</p>
              {biz?.logo_url && (
                <img src={biz.logo_url} alt="logo" className="h-16 w-auto rounded border border-slate-200" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload('logo', f).catch((err) => setMsg(err.message));
                }}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Imagen de cabecera</p>
              {biz?.hero_url && (
                <img
                  src={biz.hero_url}
                  alt="hero"
                  className="h-24 w-full rounded border border-slate-200 object-cover"
                />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload('hero', f).catch((err) => setMsg(err.message));
                }}
              />
            </div>
          </div>
        </Section>

        <Section
          title="Redes sociales"
          description="Enlaza tus perfiles para que los clientes puedan seguirte."
        >
          <div className="grid gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Instagram</label>
              <input
                className="w-full rounded border border-slate-200 px-3 py-2"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="https://instagram.com/tu_negocio"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Facebook</label>
              <input
                className="w-full rounded border border-slate-200 px-3 py-2"
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                placeholder="https://facebook.com/tu_negocio"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">TikTok</label>
              <input
                className="w-full rounded border border-slate-200 px-3 py-2"
                value={tiktok}
                onChange={(e) => setTiktok(e.target.value)}
                placeholder="https://www.tiktok.com/@tu_negocio"
              />
            </div>
          </div>
        </Section>
      </div>
 
      <div className="flex justify-end">
        <button
          onClick={() => void save()}
          disabled={saving}
          className="rounded bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}

type SectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

function Section({ title, description, children }: SectionProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className={description ? 'mb-4' : 'mb-2'}>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function HoursEditor({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const days = [
    { key: 'monday', label: 'Lunes' },
    { key: 'tuesday', label: 'Martes' },
    { key: 'wednesday', label: 'Miercoles' },
    { key: 'thursday', label: 'Jueves' },
    { key: 'friday', label: 'Viernes' },
    { key: 'saturday', label: 'Sabado' },
    { key: 'sunday', label: 'Domingo' },
  ];
 
  function updateDay(key: string, tramos: Array<{ abre: string; cierra: string }>) {
    const next = { ...(value || {}) } as any;
    next[key] = tramos;
    onChange(next);
  }
 
  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-500">Anade 0, 1 o 2 tramos por dia. Deja vacio para Cerrado.</div>
      <div className="grid gap-3">
        {days.map((d) => {
          const tramos: Array<{ abre: string; cierra: string }> = Array.isArray(value?.[d.key])
            ? value[d.key]
            : [];
          const setTramo = (i: number, field: 'abre' | 'cierra', v: string) => {
            const arr = [...tramos];
            const base = arr[i] || { abre: '', cierra: '' };
            arr[i] = { ...base, [field]: v };
            updateDay(d.key, arr);
          };
          const addTramo = () => updateDay(d.key, [...tramos, { abre: '', cierra: '' }]);
          const delTramo = (i: number) => updateDay(d.key, tramos.filter((_, idx) => idx !== i));
          return (
            <div key={d.key} className="rounded border border-slate-200 p-3">
              <div className="mb-2 text-sm font-medium text-slate-800">{d.label}</div>
              {tramos.length === 0 && <div className="mb-2 text-xs text-slate-500">Cerrado</div>}
              <div className="space-y-2">
                {tramos.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={t.abre}
                      onChange={(e) => setTramo(i, 'abre', e.target.value)}
                      className="rounded border border-slate-200 px-2 py-1"
                    />
                    <span className="text-sm text-slate-600">a</span>
                    <input
                      type="time"
                      value={t.cierra}
                      onChange={(e) => setTramo(i, 'cierra', e.target.value)}
                      className="rounded border border-slate-200 px-2 py-1"
                    />
                    <button
                      type="button"
                      className="text-xs text-red-600"
                      onClick={() => delTramo(i)}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <button type="button" className="text-xs text-blue-600" onClick={addTramo}>
                  Anadir tramo
                </button>
                {tramos.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-slate-600"
                    onClick={() => updateDay(d.key, [])}
                  >
                    Vaciar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
