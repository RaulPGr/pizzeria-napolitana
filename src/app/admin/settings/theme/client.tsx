'use client';

import { useEffect, useMemo, useState } from 'react';

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

type ThemeConfig = {
  colors?: ThemeColors;
  fonts?: ThemeFonts;
};

const DEFAULTS: Required<ThemeConfig> = {
  colors: {
    background: '#DAD6D1',
    text: '#333333',
    muted: '#666666',
    accent: '#CC2936',
    accentHover: '#A5222D',
    secondary: '#457242',
    secondaryHover: '#375a35',
    topbarStart: '#CC2936',
    topbarEnd: '#457242',
  },
  fonts: {
    body: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
    headings: 'inherit',
  },
};

function ColorInput({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  const hex = (value || '').match(/^#?[0-9a-fA-F]{6}$/) ? (value!.startsWith('#') ? value! : `#${value}`) : '';
  return (
    <label className="block text-sm">
      <span className="text-slate-700">{label}</span>
      <div className="mt-1 flex items-center gap-3">
        <input type="color" className="h-9 w-14" value={hex || '#ffffff'} onChange={(e) => onChange(e.target.value)} />
        <input
          className="flex-1 rounded-md border border-slate-300 px-2 py-1"
          placeholder="#rrggbb"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </label>
  );
}

function TextInput({ label, value, onChange, placeholder }: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string; }) {
  return (
    <label className="block text-sm">
      <span className="text-slate-700">{label}</span>
      <input
        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export default function ThemeSettingsClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeConfig>({});

  const merged = useMemo<Required<ThemeConfig>>(() => ({
    colors: { ...DEFAULTS.colors, ...(theme.colors || {}) },
    fonts: { ...DEFAULTS.fonts, ...(theme.fonts || {}) },
  }), [theme]);

  // Live preview by setting CSS vars
  useEffect(() => {
    const r = document.documentElement;
    const c = merged.colors;
    r.style.setProperty('--brand-chalk-bg', c.background);
    r.style.setProperty('--brand-ink', merged.colors.text);
    r.style.setProperty('--brand-muted', merged.colors.muted);
    r.style.setProperty('--brand-accent', merged.colors.accent);
    r.style.setProperty('--brand-accent-700', merged.colors.accentHover);
    r.style.setProperty('--brand-green', merged.colors.topbarEnd || merged.colors.secondary);
    r.style.setProperty('--brand-green-700', merged.colors.secondaryHover);
    r.style.setProperty('--brand-orange', merged.colors.topbarStart || merged.colors.accent);
    if (merged.fonts.body) r.style.setProperty('--font-body', merged.fonts.body);
    if (merged.fonts.headings) r.style.setProperty('--font-headings', merged.fonts.headings);
  }, [merged]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const resp = await fetch('/api/admin/theme', { cache: 'no-store' });
        if (!resp.ok) throw new Error('No autorizado');
        const j = await resp.json();
        if (!active) return;
        if (j?.ok) setTheme(j.theme || {});
      } catch (e: any) {
        setError(e?.message || 'Error');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  async function save() {
    try {
      setSaving(true); setError(null);
      const resp = await fetch('/api/admin/theme', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ theme }),
      });
      const j = await resp.json();
      if (!resp.ok || !j?.ok) throw new Error(j?.error || 'Error al guardar');
    } catch (e: any) {
      setError(e?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="rounded border bg-white p-4 shadow-sm">Cargando…</div>;
  if (error) return <div className="rounded border border-rose-200 bg-rose-50 p-4 text-rose-800 shadow-sm">{error}</div>;

  return (
    <div className="space-y-6 rounded border bg-white p-4 shadow-sm">
      <div>
        <h1 className="text-xl font-semibold">Tema (oculto)</h1>
        <p className="text-sm text-slate-600">Ajusta colores y tipografías de la web. Solo visible para cuentas autorizadas.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ColorInput label="Fondo principal" value={theme.colors?.background} onChange={(v) => setTheme((t) => ({ ...t, colors: { ...t.colors, background: v } }))} />
        <ColorInput label="Texto" value={theme.colors?.text} onChange={(v) => setTheme((t) => ({ ...t, colors: { ...t.colors, text: v } }))} />
        <ColorInput label="Texto secundario" value={theme.colors?.muted} onChange={(v) => setTheme((t) => ({ ...t, colors: { ...t.colors, muted: v } }))} />
        <ColorInput label="Primario (botones/enlaces)" value={theme.colors?.accent} onChange={(v) => setTheme((t) => ({ ...t, colors: { ...t.colors, accent: v } }))} />
        <ColorInput label="Primario hover" value={theme.colors?.accentHover} onChange={(v) => setTheme((t) => ({ ...t, colors: { ...t.colors, accentHover: v } }))} />
        <ColorInput label="Secundario (verde)" value={theme.colors?.secondary} onChange={(v) => setTheme((t) => ({ ...t, colors: { ...t.colors, secondary: v } }))} />
        <ColorInput label="Secundario hover" value={theme.colors?.secondaryHover} onChange={(v) => setTheme((t) => ({ ...t, colors: { ...t.colors, secondaryHover: v } }))} />
        <ColorInput label="Barra superior inicio" value={theme.colors?.topbarStart} onChange={(v) => setTheme((t) => ({ ...t, colors: { ...t.colors, topbarStart: v } }))} />
        <ColorInput label="Barra superior fin" value={theme.colors?.topbarEnd} onChange={(v) => setTheme((t) => ({ ...t, colors: { ...t.colors, topbarEnd: v } }))} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextInput label="Fuente del cuerpo" value={theme.fonts?.body} onChange={(v) => setTheme((t) => ({ ...t, fonts: { ...t.fonts, body: v } }))} placeholder="Ej: Inter, system-ui, sans-serif" />
        <TextInput label="Fuente de títulos" value={theme.fonts?.headings} onChange={(v) => setTheme((t) => ({ ...t, fonts: { ...t.fonts, headings: v } }))} placeholder="Ej: Poppins, system-ui, sans-serif" />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="btn-brand">
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <span className="text-sm text-slate-600">Los cambios se aplican de inmediato.</span>
      </div>
    </div>
  );
}
