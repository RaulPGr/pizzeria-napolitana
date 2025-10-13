// src/app/api/orders/bulk-delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type Body = {
  ids?: string[];
  range?: { from: string; to: string };
  status?: 'delivered' | 'cancelled' | 'all';
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    let ids = body.ids?.filter(Boolean) || [];

    if (ids.length === 0 && body.range) {
      const from = new Date(body.range.from).toISOString();
      const to = new Date(body.range.to).toISOString();
      let q = supabaseAdmin
        .from('orders')
        .select('id, status')
        .gte('created_at', from)
        .lt('created_at', to);
      if (body.status && body.status !== 'all') {
        q = q.eq('status', body.status);
      } else {
        // Solo histórico por defecto
        q = q.in('status', ['delivered', 'cancelled']);
      }
      const { data, error } = await q;
      if (error) throw error;
      ids = (data || []).map((r: any) => r.id);
    }

    if (ids.length === 0) {
      return NextResponse.json({ ok: true, deleted: 0 });
    }

    // Borrar primero items y luego pedidos
    const { error: e1 } = await supabaseAdmin.from('order_items').delete().in('order_id', ids);
    if (e1) throw e1;
    const { error: e2, count } = await supabaseAdmin.from('orders').delete({ count: 'exact' }).in('id', ids);
    if (e2) throw e2;

    return NextResponse.json({ ok: true, deleted: count ?? ids.length });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err?.message || 'Error eliminando pedidos' }, { status: 400 });
  }
}

