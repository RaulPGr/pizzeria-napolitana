// src/app/api/orders/[id]/status/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin"; // helper de Service Role
// Email de confirmación se envía al crear el pedido (evitamos duplicados aquí)
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

    // Nota: no se envía email en el cambio de estado para evitar duplicados.

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, message: "Error actualizando estado" }, { status: 500 });
  }
}
