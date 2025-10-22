// src/app/api/admin/theme/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { designAdminEmails, adminEmails } from '@/utils/plan';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function assertDesignAdmin(): Promise<{ ok: true; email: string } | { ok: false; res: Response }> {
  try {
    const cookieStore = await cookies();
    const supa = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set(name: string, value: string, options: any) {
            try { cookieStore.set({ name, value, ...options }); } catch {}
          },
          remove(name: string, options: any) {
            try { cookieStore.set({ name, value: '', ...options, maxAge: 0 }); } catch {}
          },
        },
      }
    );
    const { data } = await supa.auth.getUser();
    const email = data.user?.email?.toLowerCase() || '';
    const designers = designAdminEmails();
    let allowed = designers.length > 0 ? designers.includes(email) : false;
    if (!allowed && designers.length === 0) {
      // Fallback: si no hay lista de diseño, permite a admins normales
      const admins = adminEmails();
      allowed = admins.includes(email);
    }
    if (!allowed) {
      return { ok: false, res: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) };
    }
    return { ok: true, email };
  } catch {
    return { ok: false, res: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) };
  }
}

async function getTenantSlug(): Promise<string> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get('x-tenant-slug')?.value || '';
  } catch {
    return '';
  }
}

export async function GET() {
  const auth = await assertDesignAdmin();
  if (!auth.ok) return auth.res;
  const slug = await getTenantSlug();
  if (!slug) return NextResponse.json({ ok: false, error: 'Missing tenant' }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from('businesses')
    .select('theme_config')
    .eq('slug', slug)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, theme: (data?.theme_config || null) });
}

export async function PATCH(req: Request) {
  const auth = await assertDesignAdmin();
  if (!auth.ok) return auth.res;
  const slug = await getTenantSlug();
  if (!slug) return NextResponse.json({ ok: false, error: 'Missing tenant' }, { status: 400 });
  let body: any = null;
  try { body = await req.json(); } catch {}
  const theme = body?.theme && typeof body.theme === 'object' ? body.theme : null;
  if (!theme) return NextResponse.json({ ok: false, error: 'Invalid theme' }, { status: 400 });
  const { error } = await supabaseAdmin
    .from('businesses')
    .update({ theme_config: theme })
    .eq('slug', slug);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
