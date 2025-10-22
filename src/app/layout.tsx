// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { CartProvider } from "@/context/CartContext";
import Navbar from "@/components/Navbar"; // Se mantiene tu Navbar
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const metadata: Metadata = {
  title: "Comida para llevar",
  description: "Pedidos online",
};

async function getThemeStyle(): Promise<string> {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get('x-tenant-slug')?.value || '';
    if (!slug) return '';
    const { data } = await supabaseAdmin
      .from('businesses')
      .select('theme_config')
      .eq('slug', slug)
      .maybeSingle();
    const theme = (data as any)?.theme_config as any | null;
    if (!theme) return '';
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
    return `${cssVars ? `:root{${cssVars}}` : ''}`;
  } catch {
    return '';
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const themeStyle = await getThemeStyle();
  return (
    <html lang="es">
      <body className="bg-brand-chalk">
        {themeStyle && <style suppressHydrationWarning>{themeStyle}</style>}
        <CartProvider>
          {/* Header fijo en todas las páginas */}
          <div className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur border-b border-brand-crust">
            <Navbar />
          </div>

          {/* Compensación de la altura del header fijo (ajusta si tu Navbar es más alto/bajo) */}
          <main className="min-h-screen pt-[64px] md:pt-[72px]">
            {children}
          </main>
        </CartProvider>
      </body>
    </html>
  );
}
