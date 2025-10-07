// src/app/api/login/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: any) => {
          try { cookieStore.set(name, value, options); } catch {}
        },
        remove: (name: string, options: any) => {
          try { cookieStore.set(name, '', { ...options, maxAge: 0 }); } catch {}
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  // Comprobamos plan y permisos
  const PLAN = (process.env.NEXT_PUBLIC_PLAN || '').toLowerCase();
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  const { data: userRes } = await supabase.auth.getUser();
  const signedEmail = userRes.user?.email?.toLowerCase() || '';

  const isAdmin = adminEmails.includes(signedEmail);

  if (PLAN === 'starter' && !isAdmin) {
    // No se permite login en Starter si no es admin: cerramos sesión inmediatamente
    await supabase.auth.signOut();
    return NextResponse.json(
      { ok: false, error: 'Este plan no permite acceso al panel.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // OK
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
