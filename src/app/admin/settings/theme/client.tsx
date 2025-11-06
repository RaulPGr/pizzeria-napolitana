"use client";

import { useEffect, useMemo, useState } from "react";
import type { SubscriptionPlan } from "@/lib/subscription";
import { normalizeSubscriptionPlan } from "@/lib/subscription";

type ThemeColors = {
  background?: string;
  text?: string;
  muted?: string;
  accent?: string;
  accentHover?: string;
  secondary?: string;
  secondaryHover?: string;
  topbarStart?: string;
  topbarEnd?: string;
};

type ThemeFonts = {
  body?: string;
  headings?: string;
};

type ThemeHome = {
  heroOverlay?: boolean;
};

type ThemeConfig = {
  colors?: ThemeColors;
  fonts?: ThemeFonts;
  home?: ThemeHome;
  subscription?: SubscriptionPlan;
};

const DEFAULTS: {
  colors: Required<ThemeColors>;
  fonts: Required<ThemeFonts>;
  home: Required<ThemeHome>;
  subscription: SubscriptionPlan;
} = {
  colors: {
    background: "#DAD6D1",
    text: "#333333",
    muted: "#666666",
    accent: "#CC2936",
    accentHover: "#A5222D",
    secondary: "#457242",
    secondaryHover: "#375a35",
    topbarStart: "#CC2936",
    topbarEnd: "#457242",
  },
  fonts: {
    body:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
    headings: "inherit",
  },
  home: {
    heroOverlay: true,
  },
  subscription: "premium",
};

function ColorInput({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc?: string;
  value?: string;
  onChange: (v: string) => void;
}) {
  const hex = (value || "").match(/^#?[0-9a-fA-F]{6}$/)
    ? value!.startsWith("#")
      ? value!
      : `#${value}`
    : "";
  return (
    <label className="block text-sm">
      <span className="text-slate-700 inline-flex items-center gap-2">
        {label}
        {desc ? (
          <span title={desc} aria-label={desc} className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] leading-none text-slate-500">i</span>
        ) : null}
      </span>
      {desc && <span className="block text-xs text-slate-500">{desc}</span>}
      <div className="mt-1 flex items-center gap-3">
        <input type="color" className="h-9 w-14" value={hex || "#ffffff"} onChange={(e) => onChange(e.target.value)} />
        <input
          className="flex-1 rounded-md border border-slate-300 px-2 py-1"
          placeholder="#rrggbb"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </label>
  );
}

function FontSelect({
  label,
  desc,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  desc?: string;
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const presets = [
    {
      label: "Sistema (recomendada)",
      val:
        'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
    },
    { label: "Inter", val: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" },
    { label: "Poppins", val: "Poppins, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" },
    { label: "Roboto", val: "Roboto, ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial" },
    { label: "Open Sans", val: '"Open Sans", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' },
    { label: "Montserrat", val: "Montserrat, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" },
    { label: "Lato", val: "Lato, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" },
    { label: "Georgia (serif)", val: 'Georgia, Cambria, "Times New Roman", Times, serif' },
  ];
  const matchIdx = presets.findIndex((p) => (value || "").toLowerCase() === p.val.toLowerCase());
  const selectVal = matchIdx >= 0 ? presets[matchIdx].val : "";
  return (
    <div className="text-sm">
      <label className="block">
        <span className="text-slate-700 inline-flex items-center gap-2">
          {label}
          {desc ? (
            <span title={desc} aria-label={desc} className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] leading-none text-slate-500">i</span>
          ) : null}
        </span>
        {desc && <span className="block text-xs text-slate-500">{desc}</span>}
        <select
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1"
          value={selectVal}
          onChange={(e) => onChange(e.target.value || value || "")}
        >
          <option value="">- Personalizada -</option>
          {presets.map((p) => (
            <option key={p.label} value={p.val} style={{ fontFamily: p.val }}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-2">
        <input
          className="w-full rounded-md border border-slate-300 px-2 py-1"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ fontFamily: value || undefined }}
        />
        <div className="mt-1 text-xs text-slate-500">
          Puedes elegir una opcion del listado o escribir tu propia pila de fuentes.
        </div>
      </div>
    </div>
  );
}

export default function ThemeSettingsClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeConfig>({});

  const merged = useMemo(
    () => ({
      colors: { ...DEFAULTS.colors, ...(theme.colors || {}) },
      fonts: { ...DEFAULTS.fonts, ...(theme.fonts || {}) },
      home: { heroOverlay: theme.home?.heroOverlay !== false },
      subscription: normalizeSubscriptionPlan(theme.subscription),
    }),
    [theme]
  );

  const heroOverlayEnabled = merged.home.heroOverlay;
  const subscription = merged.subscription;

  const handleHeroOverlayChange = (checked: boolean) => {
    setTheme((prev) => ({
      ...prev,
      home: { ...(prev.home || {}), heroOverlay: checked },
    }));
  };

  const handleSubscriptionChange = (plan: SubscriptionPlan) => {
    setTheme((prev) => ({
      ...prev,
      subscription: plan,
    }));
  };

  // Live preview: actualiza variables CSS usadas por el sitio
  useEffect(() => {
    const r = document.documentElement;
    const c = merged.colors;
    r.style.setProperty("--brand-chalk-bg", c.background ?? "");
    r.style.setProperty("--brand-ink", merged.colors.text ?? "");
    r.style.setProperty("--brand-muted", merged.colors.muted ?? "");
    r.style.setProperty("--brand-accent", merged.colors.accent ?? "");
    r.style.setProperty("--brand-accent-700", merged.colors.accentHover ?? "");
    r.style.setProperty("--brand-green", (merged.colors.topbarEnd || merged.colors.secondary) ?? "");
    r.style.setProperty("--brand-green-700", merged.colors.secondaryHover ?? "");
    r.style.setProperty("--brand-orange", (merged.colors.topbarStart || merged.colors.accent) ?? "");
    if (merged.fonts.body) r.style.setProperty("--font-body", merged.fonts.body ?? "");
    if (merged.fonts.headings) r.style.setProperty("--font-headings", merged.fonts.headings ?? "");
  }, [merged]);

  // Cargar tema actual
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const resp = await fetch("/api/admin/theme", { cache: "no-store" });
        if (!resp.ok) throw new Error("No autorizado");
        const j = await resp.json();
        if (!active) return;
        if (j?.ok) setTheme(j.theme || {});
      } catch (e: any) {
        setError(e?.message || "Error");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    try {
      setSaving(true);
      setError(null);
      const resp = await fetch("/api/admin/theme", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ theme }),
      });
      const j = await resp.json();
      if (!resp.ok || !j?.ok) throw new Error(j?.error || "Error al guardar");
    } catch (e: any) {
      setError(e?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="rounded border bg-white p-4 shadow-sm">Cargando...</div>;
  if (error) return <div className="rounded border border-rose-200 bg-rose-50 p-4 text-rose-800 shadow-sm">{error}</div>;

  return (
    <div className="space-y-6 rounded border bg-white p-4 shadow-sm">
      <div>
        <h1 className="text-xl font-semibold">Personalizacion de tema</h1>
        <p className="text-sm text-slate-600">
          Ajusta colores, tipografias y la barra superior. Cada campo tiene una breve descripcion. Los cambios se aplican
          de inmediato tras guardar.
        </p>
      </div>

      <div className="rounded border bg-white p-4">
        <h2 className="text-sm font-medium text-slate-700">Suscripcion del negocio</h2>
        <p className="mt-1 text-xs text-slate-500">Controla que funcionalidades estan disponibles para el comercio.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label
            className={`flex items-start gap-3 rounded border px-3 py-2 text-sm ${
              subscription === "starter" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"
            }`}
          >
            <input
              type="radio"
              name="subscription"
              value="starter"
              checked={subscription === "starter"}
              onChange={() => handleSubscriptionChange("starter")}
              className="mt-1"
            />
            <span>
              <span className="block font-medium">Starter/Medium</span>
              <span className="text-xs text-slate-500">
                Acceso basico: panel con productos y configuracion. No admite pedidos online.
              </span>
            </span>
          </label>
          <label
            className={`flex items-start gap-3 rounded border px-3 py-2 text-sm ${
              subscription === "premium" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"
            }`}
          >
            <input
              type="radio"
              name="subscription"
              value="premium"
              checked={subscription === "premium"}
              onChange={() => handleSubscriptionChange("premium")}
              className="mt-1"
            />
            <span>
              <span className="block font-medium">Premium</span>
              <span className="text-xs text-slate-500">
                Incluye pedidos online, carrito y todas las secciones del panel.
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* Vista previa barra superior */}
      <div className="overflow-hidden rounded border">
        <div
          className="px-4 py-3 text-sm font-medium text-white"
          style={{
            background: `linear-gradient(90deg, ${merged.colors.topbarStart || merged.colors.accent}, ${
              merged.colors.topbarEnd || merged.colors.secondary
            })`,
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex gap-6">
              <span>Inicio</span>
              <span>Menu</span>
            </div>
            <span>Carrito</span>
          </div>
        </div>
        <div className="bg-white px-4 py-2 text-xs text-slate-600">Vista previa de la barra superior</div>
      </div>

      {/* Vista previa de botones y texto */}
      <div className="rounded border bg-white p-4">
        <div className="mb-3 text-sm font-medium text-slate-700">Vista previa de estilos</div>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded px-4 py-2 text-sm font-semibold text-white shadow-sm"
            style={{ backgroundColor: merged.colors.accent || "#999" }}
            aria-label="Boton primario"
          >
            Boton primario
          </button>
          <button
            type="button"
            className="rounded px-4 py-2 text-sm font-semibold text-white shadow-sm"
            style={{ backgroundColor: merged.colors.accentHover || merged.colors.accent || "#777" }}
            aria-label="Boton primario (hover)"
          >
            Hover (primario)
          </button>
          <button
            type="button"
            className="rounded px-4 py-2 text-sm font-semibold text-white shadow-sm"
            style={{ backgroundColor: merged.colors.secondary || "#557a52" }}
            aria-label="Boton secundario"
          >
            Boton secundario
          </button>
          <button
            type="button"
            className="rounded px-4 py-2 text-sm font-semibold text-white shadow-sm"
            style={{ backgroundColor: merged.colors.secondaryHover || merged.colors.secondary || "#476646" }}
            aria-label="Boton secundario (hover)"
          >
            Hover (secundario)
          </button>
          <span className="text-xs text-slate-600">Uso: acciones y acentos</span>
        </div>

        <div className="rounded border p-3" style={{ backgroundColor: merged.colors.background || "#f5f5f5" }}>
          <div
            className="mb-1 text-lg"
            style={{ color: merged.colors.text || "#333", fontFamily: merged.fonts.headings || "inherit", fontWeight: 600 }}
          >
            Titulo de ejemplo
          </div>
          <div className="text-sm" style={{ color: merged.colors.text || "#333", fontFamily: merged.fonts.body || "inherit" }}>
            Este es un texto de parrafo para comprobar la legibilidad con la combinacion de colores y la fuente del
            cuerpo.
          </div>
          <div className="mt-1 text-xs" style={{ color: merged.colors.muted || "#777", fontFamily: merged.fonts.body || "inherit" }}>
            Texto secundario o de ayuda (menos destacado).
          </div>
        </div>
      </div>

      {/* Colores */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ColorInput
          label="Fondo principal"
          desc="Color de fondo general de la web y tarjetas."
          value={theme.colors?.background}
          onChange={(v) => setTheme((t) => ({ ...t, colors: { ...t.colors, background: v } }))}
        />
        <ColorInput
          label="Texto"
          desc="Color principal de los textos (parrafos y titulos)."
          value={theme.colors?.text}
          onChange={(v) => setTheme((t) => ({ ...t, colors: { ...t.colors, text: v } }))}
        />
        <ColorInput
          label="Texto secundario"
          desc="Color para descripciones y etiquetas (menos destacado)."
          value={theme.colors?.muted}
          onChange={(v) => setTheme((t) => ({ ...t, colors: { ...t.colors, muted: v } }))}
        />
        <ColorInput
          label="Primario (botones/enlaces)"
          desc="Color de accion principal en botones y enlaces."
          value={theme.colors?.accent}
          onChange={(v) => setTheme((t) => ({ ...t, colors: { ...t.colors, accent: v } }))}
        />
        <ColorInput
          label="Primario hover"
          desc="Color del primario al pasar el cursor."
          value={theme.colors?.accentHover}
          onChange={(v) => setTheme((t) => ({ ...t, colors: { ...t.colors, accentHover: v } }))}
        />
        <ColorInput
          label="Secundario (verde)"
          desc="Color para acciones positivas y acentos secundarios."
          value={theme.colors?.secondary}
          onChange={(v) => setTheme((t) => ({ ...t, colors: { ...t.colors, secondary: v } }))}
        />
        <ColorInput
          label="Secundario hover"
          desc="Color del secundario al pasar el cursor."
          value={theme.colors?.secondaryHover}
          onChange={(v) => setTheme((t) => ({ ...t, colors: { ...t.colors, secondaryHover: v } }))}
        />
        <ColorInput
          label="Barra superior (inicio)"
          desc="Color izquierdo del degradado de la barra superior."
          value={theme.colors?.topbarStart}
          onChange={(v) => setTheme((t) => ({ ...t, colors: { ...t.colors, topbarStart: v } }))}
        />
        <ColorInput
          label="Barra superior (fin)"
          desc="Color derecho del degradado de la barra superior."
          value={theme.colors?.topbarEnd}
          onChange={(v) => setTheme((t) => ({ ...t, colors: { ...t.colors, topbarEnd: v } }))}
        />
      </div>

      {/* Tipografias */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FontSelect
          label="Fuente del cuerpo"
          desc="Familia tipografica para parrafos y la interfaz."
          value={theme.fonts?.body}
          onChange={(v) => setTheme((t) => ({ ...t, fonts: { ...t.fonts, body: v } }))}
          placeholder="Ej: Inter, system-ui, sans-serif"
        />
        <FontSelect
          label="Fuente de titulos"
          desc="Familia tipografica para encabezados (H1-H5)."
          value={theme.fonts?.headings}
          onChange={(v) => setTheme((t) => ({ ...t, fonts: { ...t.fonts, headings: v } }))}
          placeholder="Ej: Poppins, system-ui, sans-serif"
        />
    </div>

      {/* Portada */}
      <div className="rounded border bg-white p-4">
        <h2 className="text-sm font-medium text-slate-700">Portada</h2>
        <label className="mt-3 inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={heroOverlayEnabled}
            onChange={(e) => handleHeroOverlayChange(e.target.checked)}
          />
          <span>Mostrar nombre, eslogan y boton sobre la imagen principal</span>
        </label>
        <p className="mt-1 text-xs text-slate-500">
          Si lo desactivas, el nombre y el boton "Ver menu ahora" solo se mostraran en el banner superior.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="btn-brand">
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
        <button
          type="button"
          onClick={() =>
            setTheme({
              colors: { ...DEFAULTS.colors },
              fonts: { ...DEFAULTS.fonts },
              home: { ...DEFAULTS.home },
              subscription: DEFAULTS.subscription,
            })
          }
          className="rounded border px-3 py-1 text-sm"
          title="Restaura los valores por defecto del tema"
        >
          Restablecer por defecto
        </button>
        <span className="text-sm text-slate-600">Los cambios se aplican al guardar.</span>
      </div>
    </div>
  );
}
