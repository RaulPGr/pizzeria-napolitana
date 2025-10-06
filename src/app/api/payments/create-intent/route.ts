import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

    const { orderId, method } = body as { orderId: number; method: "card" | "bizum" };
    if (!orderId || !method) {
      return NextResponse.json({ error: "orderId y method son obligatorios" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: order, error: oErr } = await supabase
      .from("orders")
      .select("id, total_cents, payment_status, payment_method")
      .eq("id", orderId)
      .single();

    if (oErr || !order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    if (order.payment_status === "paid") {
      return NextResponse.json({ error: "Pedido ya está pagado" }, { status: 400 });
    }

    const paymentMethodTypes: Stripe.PaymentIntentCreateParams.PaymentMethodType[] =
      method === "bizum" ? ["bizum"] : ["card"];

    const paymentIntent = await stripe.paymentIntents.create({
      amount: order.total_cents,
      currency: "eur",
      payment_method_types: paymentMethodTypes,
      metadata: { order_id: String(orderId) },
    });

    await supabase
      .from("orders")
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        payment_method: method,
      })
      .eq("id", orderId);

    return NextResponse.json({ clientSecret: paymentIntent.client_secret }, { status: 200 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}
