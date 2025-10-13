// src/app/api/settings/payments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type Config = { cash: boolean; card: boolean };
const DEFAULTS: Config = { cash: true, card: true };

export async function GET() {
  try {
    // 1) Intentar esquema con allowed_payment_methods (id PK)
    const r1 = await supabaseAdmin
      .from('settings')
      .select('id, allowed_payment_methods')
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (r1.data && (r1.data as any).allowed_payment_methods) {
      const raw = (r1.data as any).allowed_payment_methods as Partial<Config>;
      const cfg = { cash: !!raw.cash, card: !!raw.card };
      return NextResponse.json({ ok: true, data: cfg });
    }

    // 2) Intentar esquema key/value
    const r2 = await supabaseAdmin
      .from('settings')
      .select('key, value')
      .eq('key', 'payments')
      .maybeSingle();

    if (r2.data && (r2.data as any).value) {
      const raw = (r2.data as any).value as Partial<Config>;
      const cfg = { cash: !!raw.cash, card: !!raw.card };
      return NextResponse.json({ ok: true, data: cfg });
    }

    // Defaults si no hay nada
    return NextResponse.json({ ok: true, data: DEFAULTS });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err?.message || 'Error obteniendo configuración' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<Config>;
    const cfg: Config = { cash: !!body.cash, card: !!body.card };

    // Intentar esquema id/allowed_payment_methods (fila 1)
    const up1 = await supabaseAdmin
      .from('settings')
      .upsert({ id: 1, allowed_payment_methods: cfg, updated_at: new Date().toISOString() } as any, {
        onConflict: 'id',
      });

    if (!up1.error) {
      return NextResponse.json({ ok: true, data: cfg });
    }

    // Si falla (p.ej., columna no existe), intentar esquema key/value
    const up2 = await supabaseAdmin
      .from('settings')
      .upsert({ key: 'payments', value: cfg } as any, { onConflict: 'key' });

    if (up2.error) {
      return NextResponse.json({ ok: false, message: up2.error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data: cfg });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err?.message || 'Error guardando configuración' }, { status: 500 });
  }
}
