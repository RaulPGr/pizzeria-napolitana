import { NextResponse, type NextRequest } from 'next/server';

// Detecta el subdominio y lo guarda en una cookie 'x-tenant-slug'
// No cambia rutas ni lógica: solo añade el contexto para RLS.
export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const host = req.headers.get('host') || '';

  // Extrae subdominio: negocio.pidelocal.es -> negocio
  let slug = '';
  const parts = host.split(':')[0].split('.');
  if (parts.length >= 3) {
    // sub.dominio.tld
    slug = parts[0].toLowerCase();
  } else if (host.startsWith('localhost')) {
    // Permite ?tenant=slug en local
    slug = url.searchParams.get('tenant') || '';
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

