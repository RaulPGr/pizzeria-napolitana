// src/app/api/settings/schedule/route.ts
import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function mergeSchedules(ordering: any | null, opening: any | null) {
  if (!ordering && !opening) return null;
  const days: Array<'monday'|'tuesday'|'wednesday'|'thursday'|'friday'|'saturday'|'sunday'> = [
    'monday','tuesday','wednesday','thursday','friday','saturday','sunday'
  ];
  const out: any = {};
  for (const d of days) {
    const ord = (ordering && Array.isArray(ordering[d]) && ordering[d].length > 0) ? ordering[d] : null;
    const ope = (opening && Array.isArray(opening[d]) && opening[d].length > 0) ? opening[d] : null;
    if (ord) out[d] = ord;
    else if (ope) out[d] = ope;
    else out[d] = [];
  }
  return out;
}

function normalizeSlug(v: string | null | undefined): string {
  const s = (v || '').trim().toLowerCase();
  return s && /^[a-z0-9-_.]{1,120}$/.test(s) ? s : '';
}

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    let slug = normalizeSlug(cookieStore.get('x-tenant-slug')?.value);
    if (!slug) {
      const hdrs = await headers();
      const host = (hdrs.get('host') || '').split(':')[0];
      const parts = host.split('.');
      if (parts.length >= 3) slug = normalizeSlug(parts[0]);
    }
    if (!slug && req) {
      try { const u = new URL(req.url); slug = normalizeSlug(u.searchParams.get('tenant')) || slug; } catch {}
    }
    if (!slug) return NextResponse.json({ ok: true, data: null });

    const { data, error } = await supabaseAdmin
      .from('businesses')
      .select('ordering_hours, opening_hours')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw error;

    const merged = mergeSchedules(data?.ordering_hours || null, data?.opening_hours || null);
    return NextResponse.json({ ok: true, data: merged });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err?.message || 'Error obteniendo horario' }, { status: 500 });
  }
}
