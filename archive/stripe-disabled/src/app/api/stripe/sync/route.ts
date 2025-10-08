// /src/app/api/stripe/sync/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

function toCents(n: number) {
  return Math.round(Number(n) * 100);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sid = searchParams.get("sid") || "";
    if (!sid) return NextResponse.json({ error: "Missing sid" }, { status: 400 });

    // ¿Ya existe el pedido?
    const { data: existing, error: existingErr } = await supabase
      .from("orders")
      .select("id")
      .eq("stripe_session_id", sid)
      .single();

    if (existing && !existingErr) {
      return NextResponse.json({ created: false, found: true, order_id: existing.id });
    }

    // Obtenemos la sesión desde Stripe
    const session = await stripe.checkout.sessions.retrieve(sid);
    // Solo si está pagada creamos el pedido
    const paid = (session.payment_status === "paid" || session.status === "complete");
    if (!paid) {
      return NextResponse.json({ created: false, found: false, reason: "not_paid" });
    }

    // Recuperamos metadata (igual que en el webhook)
    const name = session.metadata?.customer_name ?? "";
    const phone = session.metadata?.customer_phone ?? "";
    const email = session.metadata?.customer_email || null;
    const notes = session.metadata?.notes || null;
    const pickup_at = session.metadata?.pickup_at!;
    const items = JSON.parse(session.metadata?.cart ?? "[]") as { id: number; qty: number }[];

    if (!items.length) {
      return NextResponse.json({ error: "Cart vacío en metadata" }, { status: 400 });
    }

    // Cargamos productos para obtener nombre/precio
    const ids = items.map((i) => i.id);
    const { data: products, error: prodErr } = await supabase
      .from("productos")
      .select("id,nombre,precio")
      .in("id", ids);

    if (prodErr) throw prodErr;

    const map = new Map<number, { nombre: string; precio: number }>();
    for (const p of products ?? []) {
      map.set(Number(p.id), { nombre: p.nombre, precio: Number(p.precio) });
    }

    let totalCents = 0;
    const lineRows = items.map((it) => {
      const p = map.get(it.id)!;
      const unit = toCents(p.precio);
      totalCents += unit * it.qty;
      return {
        product_id: it.id,
        name: p.nombre,
        unit_price_cents: unit,
        quantity: it.qty,
      };
    });

    const orderRow = {
      customer_name: name,
      customer_phone: phone,
      customer_email: email,
      notes,
      pickup_at,
      status: "pendiente",
      total_cents: totalCents,
      payment_method: "CARD",
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      stripe_session_id: session.id,
      payment_intent: session.payment_intent ? String(session.payment_intent) : null,
    };

    const { data: orderInsert, error: orderErr } = await supabase
      .from("orders")
      .insert(orderRow)
      .select("id")
      .single();
    if (orderErr) throw orderErr;

    const orderId = orderInsert.id as string;

    const { error: linesErr } = await supabase
      .from("order_items")
      .insert(lineRows.map((l) => ({ ...l, order_id: orderId })));
    if (linesErr) throw linesErr;

    return NextResponse.json({ created: true, order_id: orderId });
  } catch (e: any) {
    console.error("SYNC error:", e);
    return NextResponse.json({ error: e.message ?? "sync_failed" }, { status: 500 });
  }
}
