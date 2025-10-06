import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-06-20",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3001";

type Item = {
  product_id: number;
  name: string;
  unit_price_cents: number;
  quantity: number;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const customer_name: string = body?.customer_name?.trim();
    const customer_phone: string = body?.customer_phone?.trim();
    const customer_email: string | null = body?.customer_email || null;
    const notes: string | null = body?.notes || null;
    const pickup_at: string = body?.pickup_at; // ISO string
    const items: Item[] = Array.isArray(body?.items) ? body.items : [];

    if (!customer_name || !customer_phone || !pickup_at || items.length === 0) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios." },
        { status: 400 }
      );
    }

    // creamos la sesión de checkout
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: items.map((it) => ({
        quantity: it.quantity,
        price_data: {
          currency: "eur",
          unit_amount: it.unit_price_cents,
          product_data: { name: it.name },
        },
      })),
      success_url: `${SITE_URL}/cart/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/cart?cancelled=1`,
      metadata: {
        // guardamos todo lo necesario para crear el pedido después del pago
        customer_name,
        customer_phone,
        customer_email: customer_email ?? "",
        notes: notes ?? "",
        pickup_at,
        items: JSON.stringify(items).slice(0, 4500), // por si acaso, límite de metadata
      },
    });

    return NextResponse.json(
      { checkout_url: session.url, session_id: session.id },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado creando la sesión de pago" },
      { status: 500 }
    );
  }
}
