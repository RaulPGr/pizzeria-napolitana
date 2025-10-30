// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { CartProvider } from "@/context/CartContext";
import Navbar from "@/components/Navbar"; // Se mantiene tu Navbar
import DayTabsClientAdjust from "@/components/DayTabsClientAdjust";
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import AuthHashRedirect from '@/components/AuthHashRedirect';

export const metadata: Metadata = {
  title: "Comida para llevar",
  description: "Pedidos online",
};

type ThemeConfig = { colors?: Record<string, string | undefined>; fonts?: Record<string, string | undefined> };

function primaryFontName(stack?: string): string | null {
  if (!stack) return null;
  const first = stack.split(',')[0]?.trim() || '';
  const unquoted = first.replace(/^\"|\"$/g, '').replace(/^'|'$/g, '');
  return unquoted || null;
}

function googleFontHrefFor(name: string): string | null {
  const n = name.toLowerCase();
  const weights = 'wght@400;500;600;700';
  if (n === 'inter') return `https://fonts.googleapis.com/css2?family=Inter:${weights}&display=swap`;
  if (n === 'poppins') return `https://fonts.googleapis.com/css2?family=Poppins:${weights}&display=swap`;
  if (n === 'montserrat') return `https://fonts.googleapis.com/css2?family=Montserrat:${weights}&display=swap`;
  if (n === 'roboto') return `https://fonts.googleapis.com/css2?family=Roboto:${weights}&display=swap`;
  if (n === 'open sans') return `https://fonts.googleapis.com/css2?family=Open+Sans:${weights}&display=swap`;
  if (n === 'lato') return `https://fonts.googleapis.com/css2?family=Lato:${weights}&display=swap`;
  return null;
}

async function getThemeAssets(): Promise<{ css: string; fontHrefs: string[] }> {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get('x-tenant-slug')?.value || '';
    if (!slug) return { css: '', fontHrefs: [] };
    const { data } = await supabaseAdmin
      .from('businesses')
      .select('theme_config')
      .eq('slug', slug)
      .maybeSingle();
    const theme = (data as any)?.theme_config as ThemeConfig | null;
    if (!theme) return { css: '', fontHrefs: [] };
    const colors = theme.colors || {};
    const fonts = theme.fonts || {};
    const vars: Record<string, string | undefined> = {
      '--brand-chalk-bg': colors.background,
      '--brand-ink': colors.text,
      '--brand-muted': colors.muted,
      '--brand-accent': colors.accent,
      '--brand-accent-700': colors.accentHover,
      '--brand-green': colors.topbarEnd || colors.secondary,
      '--brand-green-700': colors.secondaryHover,
      '--brand-orange': colors.topbarStart || colors.accent,
      '--font-body': fonts.body,
      '--font-headings': fonts.headings,
    };
    const cssVars = Object.entries(vars)
      .filter(([, v]) => typeof v === 'string' && v)
      .map(([k, v]) => `${k}: ${v};`)
      .join(' ');
    const fBody = primaryFontName(fonts.body);
    const fHead = primaryFontName(fonts.headings);
    const hrefs = [fBody, fHead]
      .filter((v, i, arr): v is string => !!v && arr.indexOf(v) === i)
      .map((n) => googleFontHrefFor(n))
      .filter((x): x is string => !!x);
    return { css: `${cssVars ? `:root{${cssVars}}` : ''}`, fontHrefs: hrefs };
  } catch {
    return { css: '', fontHrefs: [] };
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const themeAssets = await getThemeAssets();
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {themeAssets.fontHrefs.length > 0 && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            {themeAssets.fontHrefs.map((href) => (
              <link key={href} href={href} rel="stylesheet" />
            ))}
          </>
        )}
      </head>
      <body className="bg-brand-chalk">
        {/* Redirige tokens/hash de Supabase a /auth/reset si llegan a la raíz u otras rutas */}
        {/* Client-only, no afecta SSR ni la lógica existente */}
        {/* Inserción temprana para que actúe antes de cualquier interacción */}
        <AuthHashRedirect />
        {themeAssets.css && <style suppressHydrationWarning>{themeAssets.css}</style>}
        <CartProvider>
          {/* Header fijo en todas las páginas */}
          <div className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur border-b border-transparent">
            <Navbar />
          </div>

          {/* Compensación de la altura del header fijo (ajusta si tu Navbar es más alto/bajo) */}
          <main className="min-h-screen pt-[64px] md:pt-[72px]">
            <DayTabsClientAdjust />
            <div className="pt-0 md:pt-0">
              {children}
            </div>
            <footer className="mt-10 border-t border-slate-200 bg-white/60">
              <div className="mx-auto max-w-6xl p-4 md:p-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                <div className="inline-flex items-center gap-2">
                  <span>Web creada con</span>
                  <a href="https://pidelocal.es" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-emerald-700">
                    <img src="/images/pidelocal.png" alt="PideLocal" className="h-4 w-4" />
                    <span>PideLocal</span>
                  </a>
                </div>
                <div className="inline-flex items-center gap-4">
                  <a href="/legal" className="hover:underline">Aviso Legal</a>
                  <a href="/privacidad" className="hover:underline">Privacidad</a>
                  <a href="/cookies" className="hover:underline">Cookies</a>
                </div>
              </div>
            </footer>
          </main>
        </CartProvider>
      </body>
    </html>
  );
}
