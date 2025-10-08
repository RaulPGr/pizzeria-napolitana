import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-06-20",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  (process.env.SUPABASE_SERVICE_ROLE as string) ||
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string)
);

type Item = {
  product_id: number;
  name: string;
  unit_price_cents: number;
  quantity: number;
};

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const session_id = searchParams.get("session_id");

    if (!session_id) {
      return NextResponse.json({ error: "Falta session_id" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["line_items"],
    });

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "El pago no está confirmado" },
        { status: 400 }
      );
    }

    // Idempotencia: si ya existe, devolvemos OK
    {
      const { data: existing, error: exErr } = await supabase
        .from("orders")
        .select("id")
        .eq("stripe_session_id", session.id)
        .maybeSingle();

      if (!exErr && existing) {
        return NextResponse.json(
          { ok: true, order_id: existing.id, already_existed: true },
          { status: 200 }
        );
      }
    }

    const md = session.metadata || {};
    const customer_name = (md.customer_name || "").trim();
    const customer_phone = (md.customer_phone || "").trim();
    const customer_email = (md.customer_email || "").trim() || null;
    const notes = (md.notes || "").trim() || null;
    const pickup_at = md.pickup_at;

    let items: Item[] = [];
    try {
      items = JSON.parse(md.items || "[]");
    } catch {
      items = [];
    }

    if (!customer_name || !customer_phone || !pickup_at || items.length === 0) {
      return NextResponse.json(
        { error: "Faltan datos para crear el pedido después del pago" },
        { status: 400 }
      );
    }

    const total_cents =
      typeof session.amount_total === "number"
        ? session.amount_total
        : items.reduce(
            (acc, it) =>
              acc +
              Math.max(0, Number(it.unit_price_cents || 0)) *
                Math.max(1, Number(it.quantity || 0)),
            0
          );

    const orderInsert = {
      customer_name,
      customer_phone,
      customer_email,
      notes,
      pickup_at,
      total_cents,
      payment_method: "stripe" as const,   // 👈 aquí el cambio
      payment_status: "paid" as const,
      status: "pending" as const,
      stripe_session_id: session.id,
      paid_at: new Date().toISOString(),
    };

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert(orderInsert)
      .select()
      .single();

    if (orderErr || !order) {
      return NextResponse.json(
        { error: orderErr?.message || "No se pudo crear el pedido" },
        { status: 500 }
      );
    }

    const lineRows = items.map((it) => ({
      order_id: order.id,
      product_id: it.product_id,
      name: it.name,
      unit_price_cents: it.unit_price_cents,
      quantity: it.quantity,
    }));

    const { error: itemsErr } = await supabase.from("order_items").insert(lineRows);
    if (itemsErr) {
      await supabase.from("orders").delete().eq("id", order.id);
      return NextResponse.json(
        { error: itemsErr.message || "No se pudieron guardar las líneas" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, order_id: order.id }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado finalizando el pago" },
      { status: 500 }
    );
  }
}
