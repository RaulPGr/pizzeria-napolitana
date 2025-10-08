// src/app/api/checkout/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";



const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!); // ← sin apiVersion




export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.orderId) {
      return NextResponse.json({ error: "Falta orderId" }, { status: 400 });
    }
    const { orderId } = body as { orderId: string };

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Leer pedido + líneas (para crear los line_items de Stripe)
    const { data: order, error } = await supabase
      .from("orders")
      .select(
        `
        id,
        total_cents,
        customer_name,
        customer_phone,
        order_items (
          name,
          quantity,
          unit_price_cents
        )
        `
      )
      .eq("id", orderId)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    // Construir line items para Stripe
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
      (order.order_items ?? []).map((it: any) => ({
        quantity: Number(it.quantity),
        price_data: {
          currency: "eur",
          unit_amount: Number(it.unit_price_cents),
          product_data: { name: it.name ?? "Artículo" },
        },
      }));

    // Seguridad: si por lo que sea no hay líneas, añade una por el total
    if (lineItems.length === 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: Number(order.total_cents),
          product_data: { name: "Pedido" },
        },
      });
    }

    const origin =
      req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      // 🔑 Muy importante: volver a la página del pedido con ?paid=1 / ?paid=0
      success_url: `${origin}/order/${order.id}?paid=1`,
      cancel_url: `${origin}/order/${order.id}?paid=0`,
      client_reference_id: order.id,
      // (opcional) metadata para tu webhook futuro:
      metadata: { orderId: order.id },
    });

    if (!session.url) {
      return NextResponse.json({ error: "No se pudo crear la sesión de Stripe" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
