import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getTenant } from '@/lib/tenant';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantParam = searchParams.get('tenant');
    const tenant = await getTenant(tenantParam);
    if (!tenant) return NextResponse.json({ ok: true, promotions: [] });

    const { data, error } = await supabaseAdmin
      .from('promotions')
      .select('*')
      .eq('business_id', (tenant as any)?.id || null)
      .eq('active', true);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, promotions: data || [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Error cargando promociones' }, { status: 500 });
  }
}
