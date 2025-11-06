// src/app/api/admin/reservations/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function normalizeSlug(v: string | null | undefined): string {
  const s = (v || '').trim().toLowerCase();
  return s && /^[a-z0-9-_.]{1,120}$/.test(s) ? s : '';
}

async function getTenantSlug(req?: Request) {
  let slug = '';
  if (req) {
    try {
      const u = new URL(req.url);
      slug = normalizeSlug(u.searchParams.get('tenant'));
    } catch {}
  }
  if (!slug) {
    try {
      const cookieStore = await cookies();
      slug = normalizeSlug(cookieStore.get('x-tenant-slug')?.value);
    } catch {}
  }
  if (!slug) {
    try {
      const hdrs = await headers();
      const host = (hdrs.get('host') || '').split(':')[0];
      const parts = host.split('.');
      if (parts.length >= 3) slug = normalizeSlug(parts[0]);
    } catch {}
  }
  return slug;
}

export async function GET(req: Request) {
  try {
    const slug = await getTenantSlug(req);
    if (!slug) return NextResponse.json({ ok: false, error: 'Missing tenant' }, { status: 400 });

    const { data: biz, error: bizErr } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (bizErr) return NextResponse.json({ ok: false, error: bizErr.message }, { status: 400 });
    if (!biz) return NextResponse.json({ ok: false, error: 'Business not found' }, { status: 404 });

    const { data, error } = await supabaseAdmin
      .from('reservations')
      .select('id, customer_name, customer_email, customer_phone, party_size, reserved_at, notes, status, created_at')
      .eq('business_id', (biz as any)?.id)
      .order('reserved_at', { ascending: true });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, reservations: data || [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Error' }, { status: 500 });
  }
}

