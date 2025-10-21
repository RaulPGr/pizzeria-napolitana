// src/app/api/settings/schedule/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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

    const schedule = (data?.ordering_hours && Object.keys(data.ordering_hours || {}).length)
      ? data?.ordering_hours
      : (data?.opening_hours || null);

    return NextResponse.json({ ok: true, data: schedule ?? null });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err?.message || 'Error obteniendo horario' }, { status: 500 });
  }
}

