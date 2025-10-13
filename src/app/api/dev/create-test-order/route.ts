// src/app/api/dev/create-test-order/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Crea un pedido de prueba tomando 1-2 productos existentes.
// Uso: GET /api/dev/create-test-order?items=2&status=pending
// Nota: Solo disponible fuera de producción.

type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'cancelled';

export async function GET(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ ok: false, message: 'Not available in production' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const itemsCount = Math.max(1, Math.min(2, Number(searchParams.get('items')) || 1));
    const statusParam = (searchParams.get('status') || 'pending').toLowerCase() as OrderStatus;
    const allowed: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
    const status: OrderStatus = allowed.includes(statusParam) ? statusParam : 'pending';

    // Tomamos algunos productos activos para armar el pedido de prueba
    const { data: products, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('id, name, price')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true })
      .limit(itemsCount);
    if (prodErr) throw prodErr;

    if (!products || products.length === 0) {
      return NextResponse.json(
        { ok: false, message: 'No hay productos activos para crear pedidos de prueba' },
        { status: 400 }
      );
    }

    // Preparar líneas e importes
    let totalCents = 0;
    const lines = products.map((p) => {
      const quantity = 1; // fijo para simplicidad
      const unit_price_cents = Math.round(Number(p.price) * 100);
      const line_total_cents = unit_price_cents * quantity;
      totalCents += line_total_cents;
      return {
        product_id: p.id,
        name: p.name,
        unit_price_cents,
        quantity,
        line_total_cents,
      };
    });

    // Insertar pedido
    const pickupAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_name: 'Cliente Test',
        customer_phone: '600000001',
        customer_email: null,
        pickup_at: pickupAt,
        status,
        total_cents: totalCents,
        payment_method: 'cash',
        payment_status: status === 'delivered' ? 'paid' : 'unpaid',
        notes: 'Pedido de prueba (dev)'
      })
      .select('id')
      .single();
    if (insErr) throw insErr;

    const orderId: string = inserted.id;
    const code = orderId.split('-')[0];

    const { error: upErr } = await supabaseAdmin.from('orders').update({ code }).eq('id', orderId);
    if (upErr) throw upErr;

    const { error: itemsErr } = await supabaseAdmin
      .from('order_items')
      .insert(lines.map((l) => ({ ...l, order_id: orderId })));
    if (itemsErr) throw itemsErr;

    return NextResponse.json({ ok: true, orderId, code, status, items: lines.length });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: err?.message || 'Error creando pedido de prueba' },
      { status: 400 }
    );
  }
}

