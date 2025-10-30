// src/app/api/orders/[id]/status/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin"; // helper de Service Role
import { sendOrderReceiptEmail } from "@/lib/email/sendOrderReceipt";
import { cookies } from 'next/headers';

async function getTenantSlug(): Promise<string> {
  try { const c = await cookies(); return c.get('x-tenant-slug')?.value || ''; } catch { return ''; }
}
async function getBusinessIdBySlug(slug: string): Promise<string | null> {
  if (!slug) return null;
  const { data } = await supabaseAdmin.from('businesses').select('id').eq('slug', slug).maybeSingle();
  return (data as any)?.id ?? null;
}

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  try {
    const id = params.id;
    const { status } = await req.json();

    const allowed = ["pending", "confirmed", "preparing", "ready", "delivered", "cancelled"];
    if (!allowed.includes(status)) {
      return NextResponse.json({ ok: false, message: "Estado inválido" }, { status: 400 });
    }

    const slug = await getTenantSlug();
    const bid = await getBusinessIdBySlug(slug);
    let q = supabaseAdmin.from("orders").update({ status }).eq("id", id);
    const { error } = bid ? await q.eq('business_id', bid) : await q;
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });

    // Email no bloqueante: si pasa a 'confirmed' y hay email del cliente, disparamos el envío.
    (async () => {
      try {
        if (status !== 'confirmed') return;
        const { data: order } = await supabaseAdmin
          .from('orders')
          .select('id, customer_name, customer_email, total_cents, pickup_at, business_id')
          .eq('id', id)
          .maybeSingle();
        if (!order || !order.customer_email) return;
        const { data: business } = await supabaseAdmin
          .from('businesses')
          .select('name')
          .eq('id', order.business_id)
          .maybeSingle();
        const { data: lines } = await supabaseAdmin
          .from('order_items')
          .select('name, quantity, unit_price_cents')
          .eq('order_id', id);
        const items = (lines || []).map((l: any) => ({ name: l.name, qty: Number(l.quantity||0), price: Number(l.unit_price_cents||0)/100 }));
        const subtotal = items.reduce((a, it) => a + it.price * it.qty, 0);
        await sendOrderReceiptEmail({
          orderId: String(order.id),
          businessName: (business as any)?.name || 'PideLocal',
          customerEmail: order.customer_email,
          customerName: order.customer_name || undefined,
          items,
          subtotal,
          total: Number(order.total_cents||0)/100,
          pickupTime: order.pickup_at || undefined,
        });
      } catch (e) {
        console.error('[email] fallo post-confirmation:', e);
      }
    })();

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, message: "Error actualizando estado" }, { status: 500 });
  }
}
