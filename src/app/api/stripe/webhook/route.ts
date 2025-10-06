// /src/app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function toCents(n: number) {
  return Math.round(Number(n) * 100);
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature")!;
  const secret = process.env.STRIPE_WEBHOOK_SECRET!;
  const buf = Buffer.from(await req.arrayBuffer());

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, secret);
  } catch (err: any) {
    console.error("⚠️  Webhook signature verification failed.", err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const name = session.metadata?.customer_name ?? "";
      const phone = session.metadata?.customer_phone ?? "";
      const email = session.metadata?.customer_email || null;
      const notes = session.metadata?.notes || null;
      const pickup_at = session.metadata?.pickup_at!;
      const items = JSON.parse(session.metadata?.cart ?? "[]") as { id: number; qty: number }[];

      // cargar productos
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

      // Insert order + lines
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
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Error en webhook:", e);
    return new NextResponse("Webhook handler failed", { status: 500 });
  }
}
