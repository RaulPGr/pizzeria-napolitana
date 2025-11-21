// src/app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getTenant } from '@/lib/tenant';
import { notifyOrderViaTelegram } from '@/lib/order-telegram-notify';

type ItemInput = { productId: number; quantity: number };
type BodyInput = {
  customer: { name: string; phone: string; email?: string };
  pickupAt: string; // ISO
  items: ItemInput[];
  paymentMethod: 'cash' | 'card';
  notes?: string;
  pricing?: {
    subtotal?: number;
    discount?: number;
    total?: number;
    promotionId?: string | null;
    promotionName?: string | null;
  };
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BodyInput;
    const url = new URL(req.url);
    const slugParam = url.searchParams.get('tenant');

    // 0) Cargar tenant (para asociar negocio). La validación estricta del horario se realiza en cliente.
    const tenant = await getTenant(slugParam, { path: url.pathname });
    if (!tenant) {
      return NextResponse.json(
        { ok: false, message: 'Negocio no encontrado' },
        { status: 400 }
      );
    }
    const ordersEnabled = ((tenant as any)?.social?.orders_enabled ?? true) !== false;
    if (!ordersEnabled) {
      return NextResponse.json(
        { ok: false, message: 'Los pedidos online estan desactivados' },
        { status: 403 }
      );
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

    let subtotalCents = 0;
    const itemsPrepared = body.items.map((i) => {
      const p = map.get(i.productId);
      if (!p) {
        throw new Error(`Producto no existe (id=${i.productId})`);
      }
      const unit_price_cents = Math.round(Number(p.price) * 100);
      const line_total_cents = unit_price_cents * i.quantity;
      subtotalCents += line_total_cents;
      return {
        product_id: i.productId,
        name: p.name,
        unit_price_cents,
        quantity: i.quantity,
        line_total_cents,
      };
    });

    let discountCents = 0;
    let promotionId: string | null = null;
    let promotionName: string | null = body.pricing?.promotionName ? String(body.pricing.promotionName).slice(0, 120) : null;
    if (body.pricing) {
      const requestedDiscount = Math.round(Number(body.pricing.discount ?? 0) * 100);
      if (Number.isFinite(requestedDiscount) && requestedDiscount > 0) {
        discountCents = Math.min(requestedDiscount, subtotalCents);
      }
    }
    const finalTotalCents = Math.max(0, subtotalCents - discountCents);

    const requestedPromotionId = body.pricing?.promotionId ? String(body.pricing.promotionId).trim() : '';
    if (requestedPromotionId) {
      try {
        const { data: promo } = await supabaseAdmin
          .from('promotions')
          .select('id, name')
          .eq('id', requestedPromotionId)
          .eq('business_id', (tenant as any)?.id || null)
          .maybeSingle();
        if (promo?.id) {
          promotionId = promo.id as string;
          if (!promotionName) promotionName = (promo as any)?.name || null;
        }
      } catch {}
    }

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
        total_cents: finalTotalCents,
        discount_cents: discountCents,
        promotion_id: promotionId,
        promotion_name: promotionName,
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
    ;(async () => {
      try {
        // Enviar SIEMPRE si el pedido trae email del cliente (no bloquea la respuesta)
        const { data: business } = await supabaseAdmin
          .from('businesses')
          .select('name, email, address_line, city, postal_code, logo_url, social')
          .eq('id', (tenant as any)?.id || null)
          .maybeSingle();
        const itemsSimple = itemsPrepared.map((it) => ({ name: it.name, qty: it.quantity, price: it.unit_price_cents / 100 }));
        const subtotal = itemsSimple.reduce((a, it) => a + it.price * it.qty, 0);
        const { sendOrderReceiptEmail, sendOrderBusinessNotificationEmail } = await import('@/lib/email/sendOrderReceipt');
        if (body.customer?.email) {
          await sendOrderReceiptEmail({
            orderId,
            orderCode: code,
            businessName: (business as any)?.name || 'PideLocal',
            businessAddress: [ (business as any)?.address_line, (business as any)?.postal_code, (business as any)?.city ]
              .filter(Boolean)
              .join(', ') || undefined,
            businessLogoUrl: (business as any)?.logo_url || undefined,
            customerEmail: body.customer.email,
            customerName: body.customer.name,
            items: itemsSimple,
            subtotal,
            total: finalTotalCents / 100,
            pickupTime: body.pickupAt,
            notes: body.notes || undefined,
            discount: discountCents / 100,
            promotionName: promotionName || undefined,
          });
        }
        const notifySettings = (business as any)?.social || {};
        const notifyEnabled = !!notifySettings?.notify_orders_enabled;
        const notifyTarget =
          (notifySettings?.notify_orders_email && String(notifySettings.notify_orders_email).trim()) ||
          (business as any)?.email ||
          null;
        if (notifyEnabled && notifyTarget) {
          await sendOrderBusinessNotificationEmail({
            orderId,
            orderCode: code,
            businessName: (business as any)?.name || 'PideLocal',
            businessAddress: [ (business as any)?.address_line, (business as any)?.postal_code, (business as any)?.city ]
              .filter(Boolean)
              .join(', ') || undefined,
            businessLogoUrl: (business as any)?.logo_url || undefined,
            businessEmail: notifyTarget,
            items: itemsSimple,
            total: finalTotalCents / 100,
            customerName: body.customer.name,
            customerPhone: body.customer.phone,
            customerEmail: body.customer.email || null,
            pickupTime: body.pickupAt,
            notes: body.notes || undefined,
          });
        }
      } catch (e) {
        console.error('[email] create-order (non-blocking) fallo:', e);
      }
    })();

    try {
      const result = await notifyOrderViaTelegram(orderId, {
        ...(tenant as any)?.social,
        slug: (tenant as any)?.slug || "",
        businessName: (tenant as any)?.name || "",
      });
      if (!result.ok && !result.skip) {
        console.error(`[telegram] order ${orderId} fallo: ${result.error}`);
      }
    } catch (err) {
      console.error('[telegram] unexpected error', err);
    }
    return NextResponse.json({ ok: true, orderId, code });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: err?.message || 'Error creando pedido' },
      { status: 400 }
    );
  }
}


