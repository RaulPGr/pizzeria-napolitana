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

// Configuración general del negocio (datos públicos, notificaciones, redes, etc.).
export default function BusinessSettingsClient({ mode = "full" }: { mode?: "full" | "reservations" }) {
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
  const [reservationsSlots, setReservationsSlots] = useState<Array<{ from: string; to: string; capacity?: number }>>([]);
  const [reservationsLeadHours, setReservationsLeadHours] = useState<number | ''>('');
  const [reservationsMaxDays, setReservationsMaxDays] = useState<number | ''>('');
  const [reservationsAutoConfirm, setReservationsAutoConfirm] = useState(false);
  const [reservationsBlockedDates, setReservationsBlockedDates] = useState<string>('');
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const [telegramResEnabled, setTelegramResEnabled] = useState(false);
  const [telegramResConfigured, setTelegramResConfigured] = useState(false);
   const [instagram, setInstagram] = useState('');
   const [facebook, setFacebook] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [web, setWeb] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [menuMode, setMenuMode] = useState<'fixed' | 'daily'>('fixed');
  const [menuLayout, setMenuLayout] = useState<'cards' | 'list'>('cards');
  function isHHMM(v: string) {
    return /^\d{2}:\d{2}$/.test(v);
  }

  const invalidSlots = reservationsSlots
    .map((s, idx) => (!isHHMM(s.from) || !isHHMM(s.to) ? idx : -1))
    .filter((i) => i >= 0);

  const blockedDatesArray = reservationsBlockedDates
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);
  const invalidDates = blockedDatesArray.filter((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d));
  const isSlotInvalid = (s: { from: string; to: string }) => !isHHMM(s.from) || !isHHMM(s.to);
 
  // Carga inicial de la ficha del negocio (datos generales + flags).
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
        try {
          const slots = Array.isArray(j.data.reservations_slots)
            ? j.data.reservations_slots
            : [];
          setReservationsSlots(
            slots
              .map((s: any) => ({
                from: typeof s?.from === 'string' ? s.from : '',
                to: typeof s?.to === 'string' ? s.to : '',
                capacity: Number.isFinite(s?.capacity) ? Number(s.capacity) : undefined,
              }))
              .filter((s: any) => s.from || s.to)
          );
        } catch {
          setReservationsSlots([]);
        }
        const lead = Number(j.data.reservations_lead_hours ?? '');
        setReservationsLeadHours(Number.isFinite(lead) ? lead : '');
        const maxd = Number(j.data.reservations_max_days ?? '');
        setReservationsMaxDays(Number.isFinite(maxd) ? maxd : '');
        setReservationsAutoConfirm(Boolean(j.data.reservations_auto_confirm));
        if (Array.isArray(j.data.reservations_blocked_dates)) {
          setReservationsBlockedDates(j.data.reservations_blocked_dates.filter((d: any) => typeof d === 'string').join(', '));
        }
        setTelegramEnabled(Boolean(j.data.telegram_notifications_enabled));
        setTelegramConfigured(Boolean(j.data.telegram_bot_token && j.data.telegram_chat_id));
        setTelegramResEnabled(Boolean(j.data.telegram_reservations_enabled));
        setTelegramResConfigured(Boolean(j.data.telegram_reservations_bot_token && j.data.telegram_reservations_chat_id));
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
 
  // Persiste los cambios básicos (datos, switchs, redes...).
  async function save() {
    if (invalidSlots.length > 0) {
      setMsg('Revisa las franjas: usa formato HH:MM en desde/hasta.');
      return;
    }
    if (invalidDates.length > 0) {
      setMsg('Revisa las fechas bloqueadas: usa formato YYYY-MM-DD separadas por comas.');
      return;
    }
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
        reservations_slots: reservationsSlots,
        reservations_lead_hours: reservationsLeadHours === '' ? null : Number(reservationsLeadHours),
        reservations_max_days: reservationsMaxDays === '' ? null : Number(reservationsMaxDays),
        reservations_auto_confirm: reservationsAutoConfirm,
        reservations_blocked_dates: blockedDatesArray,
        telegram_notifications_enabled: telegramEnabled,
        telegram_reservations_enabled: telegramResEnabled,
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
 
  // Subida de logo o imagen de cabecera.
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
 
  const reservationsSection = canManageReservations && (
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
            <label className="text-sm font-medium text-slate-700">Capacidad por franja (comensales)</label>
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
            <p className="text-xs text-slate-500">Pon 0 para ilimitadas. El cupo se calcula por comensales.</p>
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
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Antelacion minima (horas)</label>
              <input
                className="w-full rounded border border-slate-200 px-3 py-2"
                type="number"
                min={0}
                max={240}
                value={reservationsLeadHours}
                onChange={(e) => {
                  const v = e.target.value === '' ? '' : Math.max(0, Math.floor(Number(e.target.value) || 0));
                  setReservationsLeadHours(v);
                }}
                placeholder="0 = sin limite"
              />
              <p className="text-xs text-slate-500">Tiempo minimo antes de la hora reservada.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Max dias de antelacion</label>
              <input
                className="w-full rounded border border-slate-200 px-3 py-2"
                type="number"
                min={0}
                max={180}
                value={reservationsMaxDays}
                onChange={(e) => {
                  const v = e.target.value === '' ? '' : Math.max(0, Math.floor(Number(e.target.value) || 0));
                  setReservationsMaxDays(v);
                }}
                placeholder="0 = sin limite"
              />
              <p className="text-xs text-slate-500">Dias maximos respecto a hoy para reservar.</p>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Franjas personalizadas (HH:MM)</label>
            <div className="space-y-2">
              {reservationsSlots.length === 0 && (
                <p className="text-xs text-slate-500">Sin franjas: se usa el horario de apertura y el cupo general.</p>
              )}
              {reservationsSlots.map((slot, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2">
                  <input
                    type="time"
                    value={slot.from}
                    onChange={(e) => {
                      const next = [...reservationsSlots];
                      next[idx] = { ...next[idx], from: e.target.value };
                      setReservationsSlots(next);
                    }}
                    className={`w-28 rounded border px-2 py-1 ${
                      isSlotInvalid(slot) ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                    }`}
                  />
                  <span className="text-sm text-slate-600">a</span>
                  <input
                    type="time"
                    value={slot.to}
                    onChange={(e) => {
                      const next = [...reservationsSlots];
                      next[idx] = { ...next[idx], to: e.target.value };
                      setReservationsSlots(next);
                    }}
                    className={`w-28 rounded border px-2 py-1 ${
                      isSlotInvalid(slot) ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                    }`}
                  />
                  <input
                    type="number"
                    placeholder="Cupo"
                    value={slot.capacity ?? ''}
                    onChange={(e) => {
                      const num = e.target.value === '' ? undefined : Math.max(0, Math.floor(Number(e.target.value) || 0));
                      const next = [...reservationsSlots];
                      next[idx] = { ...next[idx], capacity: num };
                      setReservationsSlots(next);
                    }}
                    className="w-24 rounded border border-slate-200 px-2 py-1"
                  />
                  <button
                    type="button"
                    className="text-xs text-red-600"
                    onClick={() => setReservationsSlots(reservationsSlots.filter((_, i) => i !== idx))}
                  >
                    Quitar
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-xs text-blue-600"
                onClick={() => setReservationsSlots([...reservationsSlots, { from: '', to: '' }])}
              >
                Anadir franja
              </button>
              {reservationsSlots.length > 0 && (
                <button
                  type="button"
                  className="text-xs text-slate-600"
                  onClick={() => setReservationsSlots([])}
                >
                  Vaciar franjas
                </button>
              )}
              {reservationsSlots.length > 0 && (
                <ul className="list-disc pl-5 text-xs text-slate-600">
                  {reservationsSlots.map((s, i) => {
                    const capText =
                      Number.isFinite(s.capacity) && s.capacity !== undefined
                        ? ` (cupo ${s.capacity})`
                        : ' (cupo general)';
                    return (
                      <li key={i}>
                        {s.from || '--:--'} - {s.to || '--:--'}
                        {capText}
                        {isSlotInvalid(s) && ' ⚠ formato HH:MM'}
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="text-xs text-slate-500">
                Si indicas cupo en la franja, se usa ese valor; si no, el cupo general. El cupo es por comensales.
              </p>
              {invalidSlots.length > 0 && (
                <p className="text-xs text-rose-600">
                  Hay franjas con formato invalido (usa HH:MM en desde y hasta).
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={reservationsAutoConfirm}
                onChange={(e) => setReservationsAutoConfirm(e.target.checked)}
              />
              <span>Confirmar automaticamente si hay disponibilidad</span>
            </label>
            <p className="text-xs text-slate-500">Si hay cupo, la reserva entra como confirmada; si no, queda pendiente.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Fechas bloqueadas (YYYY-MM-DD)</label>
            <input
              className={`w-full rounded border px-3 py-2 ${
                invalidDates.length > 0 ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
              }`}
              placeholder="2025-12-24, 2025-12-25"
              value={reservationsBlockedDates}
              onChange={(e) => setReservationsBlockedDates(e.target.value)}
            />
            <p className="text-xs text-slate-500">Separa con comas. Esas fechas no aceptaran reservas.</p>
            {invalidDates.length > 0 && (
              <p className="text-xs text-rose-600">
                Formato incorrecto en: {invalidDates.join(', ')} (usa YYYY-MM-DD)
              </p>
            )}
          </div>
        </div>
      )}
    </Section>
  );

  if (mode === "reservations") {
    return (
      <div className="space-y-8">
        <header className="space-y-2">
          <h2 className="text-2xl font-semibold text-slate-900">Configuracion de reservas</h2>
          <p className="text-sm text-slate-600">Define franjas, cupos y bloqueo de fechas.</p>
        </header>

        {msg && (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {msg}
          </div>
        )}

        <div className="space-y-6">{reservationsSection}</div>

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

        {canManageOrders && (
          <Section
            title="Alertas por Telegram (Pedidos)"
            description="Activa o desactiva los avisos. El bot y el chat se configuran en Apariencia → Tema."
          >
            {!telegramConfigured && (
              <p className="text-xs text-rose-600">
                Telegram no está configurado. Pide al superadmin que lo configure en la pestaña Tema.
              </p>
            )}
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={telegramEnabled}
                disabled={!telegramConfigured}
                onChange={(e) => setTelegramEnabled(e.target.checked)}
              />
              <span>Recibir avisos por Telegram</span>
            </label>
          </Section>
        )}

        {canManageReservations && (
          <Section
            title="Alertas por Telegram (Reservas)"
            description="Usa Telegram para enterarte de las reservas aunque no tengas el panel abierto."
          >
            {!telegramResConfigured && (
              <p className="text-xs text-rose-600">
                Telegram para reservas no está configurado. Pide al superadmin que lo añada en la pestaña Tema.
              </p>
            )}
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={telegramResEnabled}
                disabled={!telegramResConfigured}
                onChange={(e) => setTelegramResEnabled(e.target.checked)}
              />
              <span>Activar avisos para reservas</span>
            </label>
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
                  <label className="text-sm font-medium text-slate-700">Capacidad por franja (comensales)</label>
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
                  <p className="text-xs text-slate-500">Pon 0 para ilimitadas. El cupo se calcula por comensales.</p>
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
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Antelacion minima (horas)</label>
                    <input
                      className="w-full rounded border border-slate-200 px-3 py-2"
                      type="number"
                      min={0}
                      max={240}
                      value={reservationsLeadHours}
                      onChange={(e) => {
                        const v = e.target.value === '' ? '' : Math.max(0, Math.floor(Number(e.target.value) || 0));
                        setReservationsLeadHours(v);
                      }}
                      placeholder="0 = sin limite"
                    />
                    <p className="text-xs text-slate-500">Tiempo minimo antes de la hora reservada.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Max dias de antelacion</label>
                    <input
                      className="w-full rounded border border-slate-200 px-3 py-2"
                      type="number"
                      min={0}
                      max={180}
                      value={reservationsMaxDays}
                      onChange={(e) => {
                        const v = e.target.value === '' ? '' : Math.max(0, Math.floor(Number(e.target.value) || 0));
                        setReservationsMaxDays(v);
                      }}
                      placeholder="0 = sin limite"
                    />
                    <p className="text-xs text-slate-500">Dias maximos respecto a hoy para reservar.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Franjas personalizadas (HH:MM)</label>
                  <div className="space-y-2">
                    {reservationsSlots.length === 0 && (
                      <p className="text-xs text-slate-500">Sin franjas: se usa el horario de apertura y el cupo general.</p>
                    )}
                    {reservationsSlots.map((slot, idx) => (
                      <div key={idx} className="flex flex-wrap items-center gap-2">
                        <input
                          type="time"
                          value={slot.from}
                          onChange={(e) => {
                            const next = [...reservationsSlots];
                            next[idx] = { ...next[idx], from: e.target.value };
                            setReservationsSlots(next);
                          }}
                          className={`w-28 rounded border px-2 py-1 ${
                            isSlotInvalid(slot) ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                          }`}
                        />
                        <span className="text-sm text-slate-600">a</span>
                        <input
                          type="time"
                          value={slot.to}
                          onChange={(e) => {
                            const next = [...reservationsSlots];
                            next[idx] = { ...next[idx], to: e.target.value };
                            setReservationsSlots(next);
                          }}
                          className={`w-28 rounded border px-2 py-1 ${
                            isSlotInvalid(slot) ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                          }`}
                        />
                        <input
                          type="number"
                          placeholder="Cupo"
                          value={slot.capacity ?? ''}
                          onChange={(e) => {
                            const num = e.target.value === '' ? undefined : Math.max(0, Math.floor(Number(e.target.value) || 0));
                            const next = [...reservationsSlots];
                            next[idx] = { ...next[idx], capacity: num };
                            setReservationsSlots(next);
                          }}
                          className="w-24 rounded border border-slate-200 px-2 py-1"
                        />
                        <button
                          type="button"
                          className="text-xs text-red-600"
                          onClick={() => setReservationsSlots(reservationsSlots.filter((_, i) => i !== idx))}
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="text-xs text-blue-600"
                      onClick={() => setReservationsSlots([...reservationsSlots, { from: '', to: '' }])}
                    >
                      Anadir franja
                    </button>
                    {reservationsSlots.length > 0 && (
                      <button
                        type="button"
                        className="text-xs text-slate-600"
                        onClick={() => setReservationsSlots([])}
                      >
                        Vaciar franjas
                      </button>
                    )}
                    {reservationsSlots.length > 0 && (
                      <ul className="list-disc pl-5 text-xs text-slate-600">
                        {reservationsSlots.map((s, i) => {
                          const capText =
                            Number.isFinite(s.capacity) && s.capacity !== undefined
                              ? ` (cupo ${s.capacity})`
                              : ' (cupo general)';
                          return (
                            <li key={i}>
                              {s.from || '--:--'} - {s.to || '--:--'}
                              {capText}
                              {isSlotInvalid(s) && ' ⚠ formato HH:MM'}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <p className="text-xs text-slate-500">
                      Si indicas cupo en la franja, se usa ese valor; si no, el cupo general. El cupo es por comensales.
                    </p>
                    {invalidSlots.length > 0 && (
                      <p className="text-xs text-rose-600">
                        Hay franjas con formato invalido (usa HH:MM en desde y hasta).
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={reservationsAutoConfirm}
                      onChange={(e) => setReservationsAutoConfirm(e.target.checked)}
                    />
                    <span>Confirmar automaticamente si hay disponibilidad</span>
                  </label>
                  <p className="text-xs text-slate-500">Si hay cupo, la reserva entra como confirmada; si no, queda pendiente.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Fechas bloqueadas (YYYY-MM-DD)</label>
                  <input
                    className={`w-full rounded border px-3 py-2 ${
                      invalidDates.length > 0 ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                    }`}
                    placeholder="2025-12-24, 2025-12-25"
                    value={reservationsBlockedDates}
                    onChange={(e) => setReservationsBlockedDates(e.target.value)}
                  />
                  <p className="text-xs text-slate-500">Separa con comas. Esas fechas no aceptaran reservas.</p>
                  {invalidDates.length > 0 && (
                    <p className="text-xs text-rose-600">
                      Formato incorrecto en: {invalidDates.join(', ')} (usa YYYY-MM-DD)
                    </p>
                  )}
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

        {reservationsSection}
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

// Mini editor para los horarios (permite hasta dos tramos por día).
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
