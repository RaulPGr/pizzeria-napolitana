// src/app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getTenant } from '@/lib/tenant';

type ItemInput = { productId: number; quantity: number };
type BodyInput = {
  customer: { name: string; phone: string; email?: string };
  pickupAt: string; // ISO
  items: ItemInput[];
  paymentMethod: 'cash' | 'card';
  notes?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BodyInput;

    // 0) Validar contra horario de pedidos si existe
    const tenant = await getTenant();
    const schedule = (tenant as any)?.ordering_hours && Object.keys((tenant as any).ordering_hours || {}).length
      ? (tenant as any).ordering_hours
      : (tenant as any)?.opening_hours || null;
    if (body.pickupAt && schedule) {
      const when = new Date(body.pickupAt);
      if (!isInSchedule(when, schedule)) {
        return NextResponse.json({ ok: false, message: 'La hora seleccionada está fuera del horario de pedidos.' }, { status: 400 });
      }
    }

    if (!body.customer?.name || !body.customer?.phone)
      return NextResponse.json(
        { ok: false, message: 'Faltan datos del cliente' },
        { status: 400 }
      );

    if (!Array.isArray(body.items) || body.items.length === 0)
      return NextResponse.json(
        { ok: false, message: 'Debes incluir al menos 1 item' },
        { status: 400 }
      );

    // Traer precios de productos y calcular totales en céntimos
    const productIds = [...new Set(body.items.map((i) => i.productId))];
    const { data: products, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('id, name, price')
      .in('id', productIds);
    if (prodErr) throw prodErr;

    const map = new Map(products?.map((p) => [p.id, p]) || []);

    let totalCents = 0;
    const itemsPrepared = body.items.map((i) => {
      const p = map.get(i.productId);
      if (!p) {
        throw new Error(`Producto no existe (id=${i.productId})`);
      }
      const unit_price_cents = Math.round(Number(p.price) * 100);
      const line_total_cents = unit_price_cents * i.quantity;
      totalCents += line_total_cents;
      return {
        product_id: i.productId,
        name: p.name,
        unit_price_cents,
        quantity: i.quantity,
        line_total_cents,
      };
    });

    // Decidir estado inicial según método de pago
    const initialStatus = body.paymentMethod === 'card' ? 'confirmed' : 'pending';

    // Insertar pedido
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_name: body.customer.name,
        customer_phone: body.customer.phone,
        customer_email: body.customer.email || null,
        pickup_at: body.pickupAt ? new Date(body.pickupAt).toISOString() : null,
        status: initialStatus,
        total_cents: totalCents,
        payment_method: body.paymentMethod,
        payment_status: 'unpaid',
        notes: body.notes || null,
        business_id: (tenant as any)?.id || null,
      })
      .select('id')
      .single();
    if (insErr) throw insErr;

    const orderId: string = inserted.id;

    // Generar code corto (p.ej. primeros 7 chars del uuid)
    const code = orderId.split('-')[0];
    const { error: upErr } = await supabaseAdmin
      .from('orders')
      .update({ code })
      .eq('id', orderId);
    if (upErr) throw upErr;

    // Insertar los items
    const { error: itemsErr } = await supabaseAdmin
      .from('order_items')
      .insert(itemsPrepared.map((it) => ({ ...it, order_id: orderId, business_id: (tenant as any)?.id || null })));
    if (itemsErr) throw itemsErr;

    return NextResponse.json({ ok: true, orderId, code });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: err?.message || 'Error creando pedido' },
      { status: 400 }
    );
  }
}

// Helpers
function isInSchedule(date: Date, schedule: any): boolean {
  try {
    const dayKey = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][date.getDay()];
    const list: Array<{ abre?: string; cierra?: string; open?: string; close?: string }> = schedule?.[dayKey] || [];
    if (!Array.isArray(list) || list.length === 0) return false;
    const mins = date.getHours() * 60 + date.getMinutes();
    return list.some((t) => {
      const a = (t.abre ?? t.open) as string | undefined;
      const c = (t.cierra ?? t.close) as string | undefined;
      if (!a || !c) return false;
      const [ha, ma] = String(a).split(':').map(Number);
      const [hc, mc] = String(c).split(':').map(Number);
      const from = ha * 60 + ma;
      const to = hc * 60 + mc;
      return mins >= from && mins < to;
    });
  } catch {
    return true; // si hay problemas de formato, no bloquear
  }
}
