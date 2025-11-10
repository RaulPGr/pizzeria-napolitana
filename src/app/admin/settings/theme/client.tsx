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

type ThemeMenu = {
  layout?: "cards" | "list";
};

type ThemeConfig = {
  colors?: ThemeColors;
  fonts?: ThemeFonts;
  home?: ThemeHome;
  menu?: ThemeMenu;
  subscription?: SubscriptionPlan;
};

const DEFAULTS: {
  colors: Required<ThemeColors>;
  fonts: Required<ThemeFonts>;
  home: Required<ThemeHome>;
  menu: Required<ThemeMenu>;
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
  menu: {
    layout: "cards",
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
  function getTenantFromUrl(): string {
    if (typeof window === "undefined") return "";
    try {
      return new URLSearchParams(window.location.search).get("tenant") || "";
    } catch {
      return "";
    }
  }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeConfig>({});
  const [memberEmail, setMemberEmail] = useState("");
  const [memberPassword, setMemberPassword] = useState("");
  const [memberRole, setMemberRole] = useState<"staff" | "manager">("staff");
  const [memberMsg, setMemberMsg] = useState<string | null>(null);
  const [memberSaving, setMemberSaving] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [members, setMembers] = useState<
    Array<{ userId: string; email: string | null; role: string; createdAt: string | null }>
  >([]);

  const merged = useMemo(
    () => ({
      colors: { ...DEFAULTS.colors, ...(theme.colors || {}) },
      fonts: { ...DEFAULTS.fonts, ...(theme.fonts || {}) },
      home: { heroOverlay: theme.home?.heroOverlay !== false },
      menu: { layout: theme.menu?.layout === "list" ? "list" : DEFAULTS.menu.layout },
      subscription: normalizeSubscriptionPlan(theme.subscription),
    }),
    [theme]
  );

  const heroOverlayEnabled = merged.home.heroOverlay;
  const handleMenuLayoutChange = (layout: "cards" | "list") => {
    setTheme((prev) => ({
      ...prev,
      menu: { ...(prev.menu || {}), layout },
    }));
  };
  const menuLayout = merged.menu.layout;
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

  function generateMemberPassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@$%";
    let out = "";
    for (let i = 0; i < 12; i += 1) out += chars.charAt(Math.floor(Math.random() * chars.length));
    setMemberPassword(out);
    setMemberMsg(null);
  }

  async function addMember() {
    const email = memberEmail.trim().toLowerCase();
    if (!email) {
      setMemberMsg("Introduce un email valido.");
      return;
    }
    setMemberSaving(true);
    setMemberMsg(null);
    try {
      const payload: Record<string, string> = { email, role: memberRole };
      if (memberPassword.trim()) payload.password = memberPassword.trim();
      const tenant = getTenantFromUrl();
      const url = tenant ? `/api/admin/members?tenant=${encodeURIComponent(tenant)}` : "/api/admin/members";
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await resp.json();
      if (!resp.ok || !j?.ok) throw new Error(j?.error || "No se pudo crear el usuario");
      if (j?.password) {
        setMemberMsg(`Usuario creado. Entrega esta contrasena temporal: ${j.password}`);
      } else {
        setMemberMsg(j?.info || "Usuario vinculado al negocio.");
      }
      setMemberEmail("");
      setMemberPassword("");
      setMemberRole("staff");
      void loadMembers();
    } catch (e: any) {
      setMemberMsg(e?.message || "No se pudo crear el usuario");
    } finally {
      setMemberSaving(false);
    }
  }

  async function loadMembers() {
    setMembersLoading(true);
    setMembersError(null);
    try {
      const tenant = getTenantFromUrl();
      const url = tenant ? `/api/admin/members?tenant=${encodeURIComponent(tenant)}` : "/api/admin/members";
      const resp = await fetch(url, { cache: "no-store" });
      const j = await resp.json();
      if (!resp.ok || !j?.ok) throw new Error(j?.error || "No se pudieron cargar los usuarios");
      setMembers(Array.isArray(j.members) ? j.members : []);
    } catch (e: any) {
      setMembersError(e?.message || "No se pudieron cargar los usuarios");
    } finally {
      setMembersLoading(false);
    }
  }

  async function removeMember(userId: string, email?: string | null) {
    const label = email || userId;
    if (!window.confirm(`Eliminar acceso de ${label}?`)) return;
    try {
      const tenant = getTenantFromUrl();
      const url = tenant ? `/api/admin/members?tenant=${encodeURIComponent(tenant)}` : "/api/admin/members";
      const resp = await fetch(url, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const j = await resp.json();
      if (!resp.ok || !j?.ok) throw new Error(j?.error || "No se pudo eliminar el usuario");
      setMemberMsg(`Acceso eliminado para ${label}`);
      void loadMembers();
    } catch (e: any) {
      setMemberMsg(e?.message || "No se pudo eliminar el usuario");
    }
  }

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

  useEffect(() => {
    void loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
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
              <span className="block font-medium">Starter</span>
              <span className="text-xs text-slate-500">
                Acceso basico: productos y configuracion del negocio. Sin reservas ni pedidos online.
              </span>
            </span>
          </label>
          <label
            className={`flex items-start gap-3 rounded border px-3 py-2 text-sm ${
              subscription === "medium" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"
            }`}
          >
            <input
              type="radio"
              name="subscription"
              value="medium"
              checked={subscription === "medium"}
              onChange={() => handleSubscriptionChange("medium")}
              className="mt-1"
            />
            <span>
              <span className="block font-medium">Medium</span>
              <span className="text-xs text-slate-500">
                Todo lo anterior e incluye gestion de reservas online (formulario publico y panel).
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

      <div className="rounded border bg-white p-4">
        <h3 className="text-lg font-semibold">Usuarios del negocio</h3>
        <p className="text-xs text-slate-500 mb-3">
          Crea o vincula usuarios internos (roles staff o manager). Esto no afecta a superadmins.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-sm text-slate-700">Email</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              type="email"
              placeholder="usuario@correo.com"
            />
          </div>
          <div>
            <label className="text-sm text-slate-700">Rol</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value === "manager" ? "manager" : "staff")}
            >
              <option value="staff">Staff (solo productos y configuracion)</option>
              <option value="manager">Manager (puede gestionar personal)</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-700">Contrasena (opcional)</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={memberPassword}
              onChange={(e) => setMemberPassword(e.target.value)}
              type="text"
              placeholder="Deja vacio para generar una"
            />
            <button
              type="button"
              className="mt-2 text-xs text-blue-600"
              onClick={generateMemberPassword}
            >
              Generar contrasena segura
            </button>
          </div>
        </div>
        {memberMsg && (
          <div className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {memberMsg}
          </div>
        )}
        <div className="mt-4">
          <button
            onClick={() => void addMember()}
            disabled={memberSaving}
            className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-60"
          >
            {memberSaving ? "Creando..." : "Agregar usuario"}
          </button>
        </div>
      </div>

      <div className="rounded border bg-white p-4">
        <h4 className="text-sm font-medium text-slate-700 mb-2">Usuarios actuales</h4>
        {membersLoading ? (
          <div className="text-sm text-slate-500">Cargando usuarios...</div>
        ) : membersError ? (
          <div className="rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
            {membersError}
          </div>
        ) : members.length === 0 ? (
          <div className="text-sm text-slate-500">No hay usuarios vinculados todavia.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="border-b px-3 py-2">Email</th>
                  <th className="border-b px-3 py-2">Rol</th>
                  <th className="border-b px-3 py-2">Alta</th>
                  <th className="border-b px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const date = m.createdAt ? new Date(m.createdAt) : null;
                  const formatted = date ? date.toLocaleString() : "-";
                  return (
                    <tr key={m.userId} className="hover:bg-slate-50">
                      <td className="border-b px-3 py-2">{m.email || "(sin email)"}</td>
                      <td className="border-b px-3 py-2 capitalize">{m.role}</td>
                      <td className="border-b px-3 py-2">{formatted}</td>
                      <td className="border-b px-3 py-2 text-right">
                        <button
                          type="button"
                          className="text-sm text-red-600 hover:underline"
                          onClick={() => void removeMember(m.userId, m.email)}
                        >
                          Quitar acceso
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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

      <div className="rounded border bg-white p-4">
        <h2 className="text-sm font-medium text-slate-700">Diseño de la carta</h2>
        <p className="mt-1 text-xs text-slate-500">Define cómo se muestran los productos en la página /menu.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label
            className={`flex items-start gap-3 rounded border px-3 py-2 text-sm ${
              menuLayout === "cards" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"
            }`}
          >
            <input
              type="radio"
              name="menu_layout"
              value="cards"
              checked={menuLayout === "cards"}
              onChange={() => handleMenuLayoutChange("cards")}
              className="mt-1"
            />
            <span>
              <span className="block font-medium">Con imágenes</span>
              <span className="text-xs text-slate-500">
                Diseño actual basado en tarjetas con foto destacada de cada producto.
              </span>
            </span>
          </label>
          <label
            className={`flex items-start gap-3 rounded border px-3 py-2 text-sm ${
              menuLayout === "list" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"
            }`}
          >
            <input
              type="radio"
              name="menu_layout"
              value="list"
              checked={menuLayout === "list"}
              onChange={() => handleMenuLayoutChange("list")}
              className="mt-1"
            />
            <span>
              <span className="block font-medium">Listado compacto</span>
              <span className="text-xs text-slate-500">
                Muestra cada categoría en un recuadro y los productos en filas sin imagen, ideal para cartas extensas.
              </span>
            </span>
          </label>
        </div>
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
              menu: { ...DEFAULTS.menu },
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
