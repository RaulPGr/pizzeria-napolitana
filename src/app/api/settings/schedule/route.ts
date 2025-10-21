// src/app/api/settings/schedule/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
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

export async function GET() {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get('x-tenant-slug')?.value || '';
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
