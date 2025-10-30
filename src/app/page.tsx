// /src/app/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";

// Defaults (fallbacks si no hay configuración)
const INFO_DEFAULT = {
  nombre: "Pizzeria napolitana",
  slogan: "La tradición de Nápoles en cada porción.",
  telefono: "+34 600 000 000",
  email: "info@mirestaurante.com",
  whatsapp: "+34600000000",
  direccion: "Calle Mayor 123, 30001 Murcia, España",
  logoUrl: "/images/fachada.png",
  fachadaUrl: "/images/fachada.png",
  menuPath: "/menu",
};
const COORDS_DEFAULT = { lat: 37.9861, lng: -1.1303, zoom: 16 };

type Tramo = { abre: string; cierra: string };
type Dia = "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado" | "domingo";
type Horarios = Record<Dia, Tramo[]>;
const HORARIOS_DEFAULT: Horarios = {
  lunes: [],
  martes: [ { abre: "12:30", cierra: "16:00" }, { abre: "19:00", cierra: "23:30" } ],
  miercoles: [ { abre: "12:30", cierra: "16:00" }, { abre: "19:00", cierra: "23:30" } ],
  jueves: [ { abre: "12:30", cierra: "16:00" }, { abre: "19:00", cierra: "23:30" } ],
  viernes: [ { abre: "12:30", cierra: "16:00" }, { abre: "19:00", cierra: "23:30" } ],
  sabado: [ { abre: "12:30", cierra: "16:00" }, { abre: "19:00", cierra: "23:30" } ],
  domingo: [ { abre: "12:30", cierra: "16:00" }, { abre: "19:00", cierra: "23:30" } ],
};
const DAY_LABEL: Record<Dia, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};

function diaSemanaES(date = new Date()): Dia {
  const dias: Dia[] = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  return dias[date.getDay()];
}
function estaAbiertoAhora(date: Date, horarios: Horarios) {
  const tramos = horarios[diaSemanaES(date)] || [];
  if (tramos.length === 0) return false;
  const minutos = date.getHours() * 60 + date.getMinutes();
  return tramos.some((t) => {
    const abre = (t as any).abre ?? (t as any).open;
    const cierra = (t as any).cierra ?? (t as any).close;
    if (!abre || !cierra) return false;
    const [ha, ma] = String(abre).split(":").map(Number);
    const [hc, mc] = String(cierra).split(":").map(Number);
    return minutos >= ha * 60 + ma && minutos <= hc * 60 + mc;
  });
}
function formatearTramos(tramos: Tramo[]) {
  if (!tramos || tramos.length === 0) return "Cerrado";
  return tramos
    .map((t) => {
      const a = (t as any).abre ?? (t as any).open;
      const c = (t as any).cierra ?? (t as any).close;
      return a && c ? `${a}-${c}` : null;
    })
    .filter(Boolean)
    .join(" / ");
}
function jsonLd(info: typeof INFO_DEFAULT, horarios: Horarios, coords: typeof COORDS_DEFAULT) {
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: info.nombre,
    address: { "@type": "PostalAddress", streetAddress: info.direccion, addressCountry: "ES" },
    telephone: info.telefono,
    email: info.email,
    url: typeof window !== "undefined" ? window.location.origin : undefined,
    image: info.fachadaUrl,
    openingHoursSpecification: Object.entries(horarios).flatMap(([dia, tr]) => (tr as Tramo[]).map((t) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: dia, opens: t.abre, closes: t.cierra }))),
    geo: { "@type": "GeoCoordinates", latitude: coords.lat, longitude: coords.lng },
  };
}

export default function HomePage() {
  const router = useRouter();

  // Cargar configuración dinámica
  const [cfg, setCfg] = useState<any>(null);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/settings/home", { cache: "no-store" });
        const j = await r.json();
        if (j?.ok && j?.data) setCfg(j.data);
      } catch {}
    })();
  }, []);

  const INFO = useMemo(() => ({
    nombre: cfg?.business?.name || INFO_DEFAULT.nombre,
    slogan: cfg?.business?.slogan || INFO_DEFAULT.slogan,
    telefono: cfg?.contact?.phone || INFO_DEFAULT.telefono,
    email: cfg?.contact?.email || INFO_DEFAULT.email,
    whatsapp: cfg?.contact?.whatsapp || INFO_DEFAULT.whatsapp,
    direccion: cfg?.contact?.address || INFO_DEFAULT.direccion,
    logoUrl: cfg?.images?.logo || INFO_DEFAULT.logoUrl,
    fachadaUrl: cfg?.images?.hero || INFO_DEFAULT.fachadaUrl,
    menuPath: INFO_DEFAULT.menuPath,
  }), [cfg]);
  const HORARIOS_USED: Horarios = useMemo(() => {
    const h = cfg?.hours as any;
    if (!h) return HORARIOS_DEFAULT;
    const norm = (arr: any[]) => (arr || [])
      .map((r) => ({ abre: r.abre ?? r.open, cierra: r.cierra ?? r.close }))
      .filter((r) => r.abre && r.cierra);
    return {
      lunes: norm(h.monday),
      martes: norm(h.tuesday),
      miercoles: norm(h.wednesday),
      jueves: norm(h.thursday),
      viernes: norm(h.friday),
      sabado: norm(h.saturday),
      domingo: norm(h.sunday),
    } as Horarios;
  }, [cfg]);
  const abierto = useMemo(() => estaAbiertoAhora(new Date(), HORARIOS_USED), [HORARIOS_USED]);
  const mapaSrc = useMemo(() => cfg?.mapUrl ? (cfg.mapUrl as string) : `https://maps.google.com/maps?q=${COORDS_DEFAULT.lat},${COORDS_DEFAULT.lng}&z=${COORDS_DEFAULT.zoom}&output=embed`, [cfg?.mapUrl]);

  return (
    <main className="min-h-screen bg-brand-chalk text-gray-900">
      <Script id="ld-localbusiness" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(INFO, HORARIOS_USED, COORDS_DEFAULT)) }} />

      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-transparent -mt-[64px] md:-mt-[72px]">
        <div className="max-w-6xl mx-auto px-4 pt-0 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {INFO.logoUrl && <img src={INFO.logoUrl} alt={`${INFO.nombre} logo`} className="h-9 w-auto rounded" />}
            <div>
              <div className="text-sm font-medium">{INFO.nombre}</div>
              <div className="text-xs text-gray-500">{INFO.slogan}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${abierto ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{abierto ? "Abierto ahora" : "Cerrado"}</span>
            <button onClick={() => router.push(INFO.menuPath)} className="rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 text-sm">Ver menú ahora</button>
          </div>
        </div>
      </header>

      <section className="relative">
        <img src={INFO.fachadaUrl} alt="Fachada" className="h-[420px] md:h-[520px] w-full object-cover" />
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="text-3xl md:text-5xl font-bold tracking-tight text-white drop-shadow">{INFO.nombre}</div>
            <p className="text-white/90 drop-shadow">{INFO.slogan}</p>
            <button onClick={() => router.push(INFO.menuPath)} className="mt-3 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Ver menú ahora</button>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto grid gap-4 p-4 md:grid-cols-2 mt-6">
        {/* Horarios */}
        <article className="rounded-2xl border border-brand-crust bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4 text-center">Horarios</h2>
          <ul className="text-sm space-y-1">
            {(Object.keys(HORARIOS_USED) as Dia[]).map((d) => (
              <li key={d} className="flex items-center justify-between"><span className="text-gray-600">{DAY_LABEL[d]}</span><span className="font-medium">{formatearTramos(HORARIOS_USED[d])}</span></li>
            ))}
          </ul>
        </article>

        {/* Contacto + Redes */}
        <article className="rounded-2xl border border-brand-crust bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4 text-center">Contacto</h2>
          <ul className="text-sm space-y-1 contact-list">
            <li>Teléfono: <a className="text-blue-600 hover:underline" href={`tel:${INFO.telefono}`}>{INFO.telefono}</a></li>
            <li>Email: <a className="text-blue-600 hover:underline" href={`mailto:${INFO.email}`}>{INFO.email}</a></li>
            <li>Dirección: <span className="block">{INFO.direccion}</span></li>
          </ul>
          {(cfg?.social || {}).instagram || (cfg?.social || {}).facebook || (cfg?.social || {}).tiktok || (cfg?.social || {}).web ? (
            <div className="mt-4">
              <h3 className="font-medium mb-2">Síguenos</h3>
              <div className="flex flex-wrap gap-2">
                {cfg?.social?.instagram && <a href={cfg.social.instagram} target="_blank" rel="noopener noreferrer" className="text-sm rounded-full border px-3 py-1 hover:bg-gray-50">Instagram</a>}
                {cfg?.social?.facebook && <a href={cfg.social.facebook} target="_blank" rel="noopener noreferrer" className="text-sm rounded-full border px-3 py-1 hover:bg-gray-50">Facebook</a>}
                {cfg?.social?.tiktok && <a href={cfg.social.tiktok} target="_blank" rel="noopener noreferrer" className="text-sm rounded-full border px-3 py-1 hover:bg-gray-50">TikTok</a>}
                {cfg?.social?.web && <a href={cfg.social.web} target="_blank" rel="noopener noreferrer" className="text-sm rounded-full border px-3 py-1 hover:bg-gray-50">Web</a>}
              </div>
            </div>
          ) : null}
        </article>
      </section>

      {/* Mapa */}
      <section className="max-w-6xl mx-auto px-4 pb-10 mt-8">
        <h2 className="text-xl font-semibold mb-4 text-center">Dónde estamos</h2>
        <div className="rounded-2xl overflow-hidden border border-brand-crust bg-white shadow-sm">
          <iframe title={`Mapa de ${INFO.nombre}`} src={mapaSrc} className="w-full h-[360px]" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        </div>
      </section>

      {/* Sobre nosotros */}
      <section className="max-w-6xl mx-auto px-4 pb-14 mt-8">
        <div className="rounded-2xl border border-brand-crust bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4 text-center">Sobre nosotros</h2>
          <p className="text-sm leading-6 text-gray-700">{cfg?.business?.description ? cfg.business.description : (<>En <strong>{INFO.nombre}</strong> no solo hacemos pizza, revivimos la tradición.

<p>Preparamos cada día nuestras auténticas recetas napolitanas con la passione italiana, utilizando ingredientes de primera calidad como el Tomate San Marzano D.O.P. y la Mozzarella Fior di Latte, garantizando el sabor original.</p>

<p></p>Nuestro objetivo es que saborees la verdadera pizza napolitana de forma rica y rápida. Perfecta para llevar (takeaway).

¡Ti aspettiamo! (¡Te esperamos!)</>)}</p>
        </div>
      </section>

      {/* Footer propio de portada eliminado: los enlaces legales viven en el footer global */}
    </main>
  );
}
