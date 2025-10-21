// src/app/api/settings/home/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, service, { auth: { persistSession: false } });
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get('x-tenant-slug')?.value || '';
    if (!slug) {
      return NextResponse.json({ ok: true, data: null });
    }
    const supa = adminClient();
    const { data: biz, error } = await supa
      .from('businesses')
      .select('name, slogan, phone, whatsapp, email, address_line, opening_hours, logo_url, hero_url')
      .eq('slug', slug)
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    if (!biz) return NextResponse.json({ ok: true, data: null });

    const hours = biz.opening_hours || null;
    const out = {
      business: { name: biz.name || null, slogan: biz.slogan || null },
      contact: {
        phone: biz.phone || null,
        whatsapp: biz.whatsapp || null,
        email: biz.email || null,
        address: biz.address_line || null,
      },
      hours: hours,
      images: { logo: biz.logo_url || null, hero: biz.hero_url || null },
    };
    return NextResponse.json({ ok: true, data: out });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Error' }, { status: 500 });
  }
}

