// src/app/api/login/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSubscriptionForSlug } from '@/lib/subscription-server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

function normalizeSlug(v: string | null | undefined): string {
  const s = (v || '').trim().toLowerCase();
  return s && /^[a-z0-9-_.]{1,120}$/.test(s) ? s : '';
}

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

  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const { data: userRes } = await supabase.auth.getUser();
  const signedEmail = userRes.user?.email?.toLowerCase() || '';
  const isSuper = adminEmails.includes(signedEmail);
  const userId = userRes.user?.id || null;

  const slug = normalizeSlug(cookieStore.get('x-tenant-slug')?.value);
  if (!slug && !isSuper) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { ok: false, error: 'Selecciona el negocio antes de iniciar sesion.' },
      { status: 403 }
    );
  }

  let isMember = false;
  if (slug && userId) {
    const { data: biz } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    const businessId = (biz as any)?.id as string | undefined;
    if (businessId) {
      const { data: member } = await supabaseAdmin
        .from('business_members')
        .select('role')
        .eq('business_id', businessId)
        .eq('user_id', userId)
        .maybeSingle();
      isMember = !!member;
    }
  }

  if (!isMember && !isSuper) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { ok: false, error: 'No tienes acceso a este negocio.' },
      { status: 403 }
    );
  }

  try { await getSubscriptionForSlug(slug); } catch {}

  return NextResponse.json({ ok: true, superuser: isSuper }, { headers: { 'Cache-Control': 'no-store' } });
}

