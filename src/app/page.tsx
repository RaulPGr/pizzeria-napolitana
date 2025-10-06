// /src/app/page.tsx
"use client";

/**
 * HOME profesional para un comercio de comida para llevar (Next.js + Tailwind).
 * Qué debes personalizar por negocio (BUSCA las etiquetas "▶ CAMBIAR AQUÍ"):
 *  - INFO_BASICA: nombre, slogan, teléfono, email, WhatsApp, dirección
 *  - HORARIOS: ajusta los tramos por día
 *  - COORDENADAS_MAPA: lat/lng de Google Maps
 *  - REDES_SOCIALES: URLs si existen
 *  - METODOS_PAGO: muestra/oculta según acepte
 *  - IMAGENES: ruta de la foto de fachada y logo (colócalas en /public/images)
 */

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";

// ▶ CAMBIAR AQUÍ: información básica del comercio
const INFO_BASICA = {
  nombre: "Mi Restaurante Ejemplo",
  slogan: "Comida casera para llevar, hecha cada día",
  telefono: "+34 600 000 000",
  email: "info@mirestaurante.com",
  // WhatsApp en formato internacional sin signos (+34XXXX...) o con el + (ambos funcionan en wa.me)
  whatsapp: "+34600000000",
  direccion: "Calle Mayor 123, 30001 Murcia, España",
  // Ruta del logo en /public/images (opcional, puedes dejar vacío)
  logoUrl: "/images/fachada.png",
  // Imagen de fachada (prioriza 1600x900 aprox). Coloca el archivo en /public/images
  fachadaUrl: "/images/fachada.png",
  // URL del menú (la ruta ya existe en tu proyecto)
  menuPath: "/menu",
};

// ▶ CAMBIAR AQUÍ: coordenadas para Google Maps (clic derecho en Google Maps → ¿Qué hay aquí?)
const COORDENADAS_MAPA = {
  lat: 37.9861, // ej. Murcia centro
  lng: -1.1303,
  zoom: 16, // opcional
};

// ▶ CAMBIAR AQUÍ: horarios por día (24h). Varios tramos permitidos por día.
// Formato: "HH:MM" en zona local del comercio. Deja [] si está cerrado.
// Si hace turno partido, añade dos tramos: [{abre:"13:00", cierra:"16:00"}, {abre:"20:00", cierra:"23:00"}]
type Tramo = { abre: string; cierra: string };
type HorarioDia = Tramo[];
const HORARIOS: Record<
  "lunes" | "martes" | "miércoles" | "jueves" | "viernes" | "sábado" | "domingo",
  HorarioDia
> = {
  // ejemplo formato con horario partido:
  // lunes: [{ abre: "12:30", cierra: "16:00" }, { abre: "20:00", cierra: "23:00" }],
  lunes: [{ abre: "12:30", cierra: "16:00" }],
  martes: [{ abre: "12:30", cierra: "16:00" }],
  miércoles: [{ abre: "12:30", cierra: "16:00" }],
  jueves: [{ abre: "12:30", cierra: "16:00" }],
  viernes: [{ abre: "12:30", cierra: "16:00" }],
  sábado: [],
  domingo: [], // cerrado
};

// ▶ CAMBIAR AQUÍ: redes sociales (deja vacío si no tiene alguna)
const REDES_SOCIALES = {
  instagram: "https://instagram.com/tu_restaurante",
  facebook: "https://facebook.com/tu_restaurante",
  tiktok: "",
  web: "", // si tuviera otra web
};

// ▶ CAMBIAR AQUÍ: métodos de pago aceptados
const METODOS_PAGO = {
  efectivo: true,
  tarjeta: true,
  bizum: false,
  onlineStripe: false, // si tenéis checkout online
};

// Utilidad: obtiene el día de la semana en minúsculas en español
function diaSemanaES(date = new Date()): keyof typeof HORARIOS {
  const dias: (keyof typeof HORARIOS)[] = [
    "domingo",
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
  ];
  return dias[date.getDay()];
}

// Comprueba si está abierto ahora según HORARIOS
function estaAbiertoAhora(date = new Date()) {
  const hoy = diaSemanaES(date);
  const tramos = HORARIOS[hoy];
  if (!tramos || tramos.length === 0) return false;

  const minutos = date.getHours() * 60 + date.getMinutes();
  return tramos.some((t) => {
    const [ha, ma] = t.abre.split(":").map(Number);
    const [hc, mc] = t.cierra.split(":").map(Number);
    const minA = ha * 60 + ma;
    const minC = hc * 60 + mc;
    return minutos >= minA && minutos <= minC;
  });
}

// Convierte horarios a texto legible
function formatearTramos(tramos: Tramo[]) {
  if (!tramos || tramos.length === 0) return "Cerrado";
  return tramos.map((t) => `${t.abre}–${t.cierra}`).join(" / ");
}

// JSON-LD para SEO LocalBusiness
function getLocalBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: INFO_BASICA.nombre,
    address: {
      "@type": "PostalAddress",
      streetAddress: INFO_BASICA.direccion,
      addressLocality: "Murcia", // ▶ CAMBIAR AQUÍ: ciudad
      addressCountry: "ES",
    },
    telephone: INFO_BASICA.telefono,
    email: INFO_BASICA.email,
    servesCuisine: "Comida casera, para llevar", // ▶ CAMBIAR si procede
    url: typeof window !== "undefined" ? window.location.origin : undefined,
    image: INFO_BASICA.fachadaUrl,
    openingHoursSpecification: Object.entries(HORARIOS).flatMap(([dia, tramos]) =>
      tramos.map((t) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: dia,
        opens: t.abre,
        closes: t.cierra,
      }))
    ),
    geo: {
      "@type": "GeoCoordinates",
      latitude: COORDENADAS_MAPA.lat,
      longitude: COORDENADAS_MAPA.lng,
    },
  };
}

export default function HomePage() {
  const router = useRouter();
  const abierto = useMemo(() => estaAbiertoAhora(new Date()), []);

  // Construye URL de mapa embebido sin API key usando <iframe>
  const mapaSrc = useMemo(() => {
    const { lat, lng, zoom } = COORDENADAS_MAPA;
    // ▶ Si prefieres usar PlaceID, reemplaza por la URL de embed de Google Maps
    return `https://maps.google.com/maps?q=${lat},${lng}&z=${zoom}&output=embed`;
  }, []);

  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* JSON-LD para SEO */}
      <Script
        id="ld-localbusiness"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(getLocalBusinessJsonLd()) }}
      />

      {/* Barra superior con logo + CTA menú */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* ▶ CAMBIAR: logo del negocio (opcional) */}
            {INFO_BASICA.logoUrl ? (
              // Si usas next/image añade configuración en next.config; img simple funciona sin config
              <img
                src={INFO_BASICA.logoUrl}
                alt={`${INFO_BASICA.nombre} logo`}
                className="h-9 w-auto rounded"
              />
            ) : null}
            <div className="flex flex-col">
              <span className="font-semibold">{INFO_BASICA.nombre}</span>
              <span className="text-xs text-gray-500 hidden sm:block">{INFO_BASICA.slogan}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <EstadoApertura abierto={abierto} />
            <button
              onClick={() => router.push(INFO_BASICA.menuPath)}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition"
              aria-label="Ver menú"
            >
              {/* ▶ Este botón lleva al menú */}
              Ver menú
            </button>
          </div>
        </div>
      </header>

      {/* HERO con foto de fachada */}
      <section className="relative">
        {/* ▶ CAMBIAR: imagen de fachada */}
        <img
          src={INFO_BASICA.fachadaUrl}
          alt={`Fachada de ${INFO_BASICA.nombre}`}
          className="h-[52vh] w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full px-4">
          <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
            <h1 className="text-white text-3xl sm:text-5xl font-extrabold drop-shadow">
              {INFO_BASICA.nombre}
            </h1>
            <p className="mt-2 text-white/90 text-sm sm:text-base">{INFO_BASICA.slogan}</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => router.push(INFO_BASICA.menuPath)}
                className="rounded-2xl px-5 py-3 text-sm font-semibold bg-white text-gray-900 hover:opacity-95"
              >
                Ver menú ahora
              </button>
              {/* ▶ CTA rápido por WhatsApp (opcional) */}
               {/*<a
                href={`https://wa.me/${INFO_BASICA.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl px-5 py-3 text-sm font-semibold bg-green-600 text-white hover:bg-green-700"
              >
                Pedir por WhatsApp
              </a>*/}
              
            </div>
          </div>
        </div>
      </section>

      {/* Sección de info principal: horarios + contacto + pagos */}
      <section className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* HORARIOS */}
        <article className="rounded-2xl border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-3">Horarios</h2>
          <ul className="space-y-2 text-sm">
            {(
              [
                "lunes",
                "martes",
                "miércoles",
                "jueves",
                "viernes",
                "sábado",
                "domingo",
              ] as (keyof typeof HORARIOS)[]
            ).map((d) => (
              <li key={d} className="flex items-center justify-between">
                <span className="capitalize">{d}</span>
                <span className="tabular-nums">{formatearTramos(HORARIOS[d])}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <EstadoApertura abierto={abierto} grande />
          </div>
        </article>

        {/* CONTACTO */}
        <article className="rounded-2xl border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-3">Contacto</h2>
          <ul className="space-y-2 text-sm">
            <li>
              Teléfono:{" "}
              <a className="text-blue-600 hover:underline" href={`tel:${INFO_BASICA.telefono}`}>
                {INFO_BASICA.telefono}
              </a>
            </li>
            <li>
              Email:{" "}
              <a className="text-blue-600 hover:underline" href={`mailto:${INFO_BASICA.email}`}>
                {INFO_BASICA.email}
              </a>
            </li>
            <li>
              Dirección: <span className="block">{INFO_BASICA.direccion}</span>
            </li>
          </ul>

          {/* REDES SOCIALES (mostrar solo si hay URL) */}
          <div className="mt-4">
            <h3 className="font-medium mb-2">Síguenos</h3>
            <div className="flex flex-wrap gap-2">
              {REDES_SOCIALES.instagram && (
                <a
                  href={REDES_SOCIALES.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm rounded-full border px-3 py-1 hover:bg-gray-50"
                >
                  Instagram
                </a>
              )}
              {REDES_SOCIALES.facebook && (
                <a
                  href={REDES_SOCIALES.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm rounded-full border px-3 py-1 hover:bg-gray-50"
                >
                  Facebook
                </a>
              )}
              {REDES_SOCIALES.tiktok && (
                <a
                  href={REDES_SOCIALES.tiktok}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm rounded-full border px-3 py-1 hover:bg-gray-50"
                >
                  TikTok
                </a>
              )}
              {REDES_SOCIALES.web && (
                <a
                  href={REDES_SOCIALES.web}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm rounded-full border px-3 py-1 hover:bg-gray-50"
                >
                  Web
                </a>
              )}
            </div>
          </div>
        </article>

        {/* MÉTODOS DE PAGO */}
        <article className="rounded-2xl border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-3">Métodos de pago</h2>
          <ul className="text-sm grid grid-cols-2 gap-2">
            {METODOS_PAGO.efectivo && <li>• Efectivo</li>}
            {METODOS_PAGO.tarjeta && <li>• Tarjeta</li>}
            {METODOS_PAGO.bizum && <li>• Bizum</li>}
            {METODOS_PAGO.onlineStripe && <li>• Pago online seguro</li>}
          </ul>

          {/* Mensaje destacable */}
          <div className="mt-4 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
            {/* ▶ CAMBIAR: normas o mensaje corto (opcional) */}
            * Encargos con 30 minutos de antelación. Alérgenos bajo consulta.
          </div>
        </article>
      </section>

      {/* MAPA */}
      <section className="max-w-6xl mx-auto px-4 pb-10">
        <h2 className="text-xl font-semibold mb-3">Dónde estamos</h2>
        <div className="rounded-2xl overflow-hidden border border-gray-200">
          {/* Iframe de Google Maps sin API key */}
          <iframe
            title={`Mapa de ${INFO_BASICA.nombre}`}
            src={mapaSrc}
            className="w-full h-[360px]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </section>

      {/* SOBRE NOSOTROS */}
      <section className="max-w-6xl mx-auto px-4 pb-14">
        <div className="rounded-2xl border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-3">Sobre nosotros</h2>
          {/* ▶ CAMBIAR: texto de presentación breve */}
          <p className="text-sm leading-6 text-gray-700">
            En <strong>{INFO_BASICA.nombre}</strong> preparamos cada día platos caseros con
            ingredientes frescos de proximidad. Nuestro objetivo es que puedas disfrutar de una
            comida rica y rápida, para llevar o encargar por WhatsApp. ¡Te esperamos!
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-8 text-sm text-gray-600 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>
            © {new Date().getFullYear()} {INFO_BASICA.nombre}. Todos los derechos reservados.
          </span>
          <div className="flex items-center gap-4">
            {/* ▶ Enlaces legales si los tienes */}
            <a href="/legal/aviso-legal" className="hover:underline">
              Aviso Legal
            </a>
            <a href="/legal/privacidad" className="hover:underline">
              Privacidad
            </a>
            <a href="/legal/cookies" className="hover:underline">
              Cookies
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

// Componente Estado Abierto/Cerrado
function EstadoApertura({ abierto, grande = false }: { abierto: boolean; grande?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full ${
        grande ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs"
      } ${abierto ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"} border`}
      aria-live="polite"
    >
      <span
        className={`inline-block rounded-full ${
          grande ? "h-2.5 w-2.5" : "h-2 w-2"
        } ${abierto ? "bg-green-500" : "bg-red-500"}`}
      />
      {abierto ? "Abierto ahora" : "Cerrado ahora"}
    </span>
  );
}
