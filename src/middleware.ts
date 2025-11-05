import { NextResponse, type NextRequest } from 'next/server';

// Detecta el subdominio y lo guarda en una cookie 'x-tenant-slug'
// No cambia rutas ni lógica: solo añade el contexto para RLS.
export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const host = req.headers.get('host') || '';

  // 1) Intentar subdominio: negocio.pidelocal.es -> negocio
  let slug = '';
  const parts = host.split(':')[0].split('.');
  if (parts.length >= 3) {
    slug = parts[0].toLowerCase();
  }
  // 2) Si no hay subdominio (p.ej. previews de Vercel), aceptar ?tenant=
  if (!slug) {
    const q = (url.searchParams.get('tenant') || '').trim().toLowerCase();
    if (q && /^[a-z0-9-_.]{1,120}$/.test(q)) slug = q;
  }

  const res = NextResponse.next();
  if (slug) {
    res.cookies.set('x-tenant-slug', slug, { path: '/', httpOnly: false });
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next|api/health|favicon.ico).*)'],
};
