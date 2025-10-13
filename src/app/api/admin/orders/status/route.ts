// src/app/api/admin/orders/status/route.ts

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { id, status } = (await req.json().catch(() => ({}))) as {
      id?: string;
      status?: string;
    };

    if (!id || !status) {
      return NextResponse.json(
        { error: 'Faltan id o status' },
        { status: 400 }
      );
    }

    // Solo permitimos estos 4 estados (coinciden con lo que ya usas en el admin).
    const ALLOWED = ['pendiente', 'listo', 'entregado', 'cancelado'] as const;
    if (!ALLOWED.includes(status as any)) {
      return NextResponse.json(
        { error: 'Estado no permitido' },
        { status: 400 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
        { status: 500 }
      );
    }
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Error' },
      { status: 500 }
    );
  }
}
