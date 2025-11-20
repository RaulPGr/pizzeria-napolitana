// src/app/api/whoami/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: any) => {
          try { cookieStore.set({ name, value, ...options }); } catch {}
        },
        remove: (name: string, options: any) => {
          try { cookieStore.set({ name, value: '', ...options, maxAge: 0 }); } catch {}
        },
      },
    }
  );

  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    return NextResponse.json(
      { ok: false, email: null, error: error?.message ?? 'Auth session missing!' },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // Is the user a member of the current tenant?
  let isMember = false;
  try {
    const slug = cookieStore.get('x-tenant-slug')?.value || '';
    if (slug) {
      const { data: biz } = await supabaseAdmin
        .from('businesses')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
      const bid = (biz as any)?.id as string | undefined;
      if (bid) {
        const { data: mm } = await supabaseAdmin
          .from('business_members')
          .select('user_id')
          .eq('business_id', bid)
          .eq('user_id', data.user.id)
          .maybeSingle();
        isMember = !!mm;
        if (isMember) {
          try {
            await supabaseAdmin
              .from('business_members')
              .update({ last_access_at: new Date().toISOString() })
              .eq('business_id', bid)
              .eq('user_id', data.user.id);
          } catch {}
          try {
            await supabaseAdmin
              .from('business_member_access_logs')
              .insert({ business_id: bid, user_id: data.user.id });
          } catch {}
        }
      }
    }
  } catch {}

  return NextResponse.json(
    { ok: true, email: data.user.email, isMember, error: null },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
