// src/app/api/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Crea una sesión de Stripe Checkout para un pedido existente.
 * Espera en el body: { order_id: string | number, method?: "CARD" | "BIZUM" }
 * - Lee el total real del pedido desde la BD (evita manipulación en cliente).
 * - Envía metadata con order_id (y method) para que el webhook pueda conciliar.
 * - Devuelve { url } para redirigir al checkout.
 */
export async function POST(req: NextRequest) {
  try {
    const { order_id, method }: { order_id?: string | number; method?: "CARD" | "BIZUM" } =
      await req.json();

    if (!order_id) {
      return NextResponse.json({ error: "Falta order_id" }, { status: 400 });
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: "Falta STRIPE_SECRET_KEY" }, { status: 500 });
    }

    const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

    // 1) Leer total real del pedido
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id,total_cents")
      .eq("id", order_id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }
    if (!order.total_cents || order.total_cents <= 0) {
      return NextResponse.json({ error: "Importe del pedido inválido" }, { status: 400 });
    }

    // 2) Construir URLs de retorno
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      req.headers.get("origin") ||
      "http://localhost:3000";

    // 3) Tipos de método de pago
    const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
      method === "BIZUM" ? ["card", "bizum"] : ["card"];

    // 4) Crear sesión de Checkout
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: paymentMethodTypes,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: `Pedido #${order_id}` },
            unit_amount: order.total_cents, // en céntimos
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/order/${order_id}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/order/${order_id}?canceled=1`,
      client_reference_id: String(order_id),
      metadata: {
        order_id: String(order_id),
        method: method || "CARD", // útil para el webhook
      },
      locale: "es",
    });

    // 5) Guardar opcionalmente el id de sesión en la orden
    await supabaseAdmin
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order_id);

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (e: any) {
    console.error("Error creando sesión de checkout:", e?.message || e);
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}
