// src/app/api/orders/[id]/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin"; // <- usa tu helper de Service Role
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

export async function GET(_req: Request, { params }: Params) {
  try {
    const id = params.id;

    // Pedido
    // Limitar por negocio
    const slug = await getTenantSlug();
    const bid = await getBusinessIdBySlug(slug);

    const { data: order, error: e1 } = await supabaseAdmin
      .from("orders")
      .select(
        "id, code, customer_name, customer_phone, pickup_at, status, total_cents, payment_method, payment_status, created_at, notes"
      )
      .eq("id", id)
      .eq(bid ? "business_id" : "id", bid ? (bid as any) : id)
      .single();

    if (e1 || !order) {
      return NextResponse.json({ ok: false, message: e1?.message || "Pedido no encontrado" }, { status: 404 });
    }

    // Items
    const { data: items, error: e2 } = await supabaseAdmin
      .from("order_items")
      .select("id, product_id, name, unit_price_cents, quantity, line_total_cents")
      .eq("order_id", id)
      .order("created_at", { ascending: true });

    if (e2) {
      return NextResponse.json({ ok: false, message: e2.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data: { order, items: items || [] } });
  } catch (e) {
    return NextResponse.json({ ok: false, message: "Error obteniendo el detalle" }, { status: 500 });
  }
}
