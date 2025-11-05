// src/app/api/diag/business-exists/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, service, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const slug = (u.searchParams.get('slug') || '').trim().toLowerCase();
    if (!slug) return NextResponse.json({ ok: false, error: 'missing slug' }, { status: 400 });
    const supa = adminClient();
    const { data, error } = await supa
      .from('businesses')
      .select('id, slug, name')
      .eq('slug', slug)
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, slug, found: !!data, data: data || null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Error' }, { status: 500 });
  }
}

