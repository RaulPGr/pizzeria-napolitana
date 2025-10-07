// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { PLAN, adminEmails } from '@/utils/plan';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const { data: { user } } = await supabase.auth.getUser();

  // Debe estar logueado para /admin
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Reglas por plan
  const email = (user.email || '').toLowerCase();
  const isAdminEmail = adminEmails().includes(email);

  if (PLAN === 'starter' && !isAdminEmail) {
    // En Starter, solo los correos listados pueden acceder
    return NextResponse.redirect(new URL('/', req.url));
  }

  // En Medium, cualquier usuario logueado puede acceder
  return res;
}

export const config = {
  matcher: ['/admin/:path*'],
};
