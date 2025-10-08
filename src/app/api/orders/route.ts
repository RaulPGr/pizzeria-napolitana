// src/app/api/orders/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin"; // tu cliente admin

// ---------------------------------------------------------------------------
// GET /api/orders
// Devuelve pedidos + líneas (alias 'items'); filtro por rango ?range=today|7d|30d|all
// ---------------------------------------------------------------------------
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") ?? "7d";

    const now = new Date();
    let fromISO: string | null = null;

    if (range === "today") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      fromISO = d.toISOString();
    } else if (range === "7d") {
      fromISO = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (range === "30d") {
      fromISO = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }
    // "all" => fromISO = null

// crea el cliente admin invocando la factory
const db = supabaseAdmin(); // 👈 importante: paréntesis

    let q = db
      .from("orders")
      .select(
        `
        id,
        code,
        created_at,
        pickup_at,
        customer_name,
        customer_phone,
        customer_email,
        notes,
        total_cents,
        status,
        payment_method,
        payment_status,
        stripe_session_id,
        items:order_items (
          name,
          quantity,
          unit_price_cents,
          line_total_cents
        )
      `
      )
      .order("created_at", { ascending: false });

    if (fromISO) q = q.gte("created_at", fromISO);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ orders: data ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/orders  (EFECTIVO)
// Crea pedido y líneas para pagos en efectivo. La tarjeta sigue en /api/orders/card.
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      customer_name,
      customer_phone,
      customer_email = null,
      notes = null,
      pickup_at,            // ISO string
      payment_method,       // "cash" para este endpoint
      items,
    } = body ?? {};

    // Validaciones
    if (!customer_name || !customer_phone) {
      return NextResponse.json(
        { error: "Faltan nombre o teléfono del cliente." },
        { status: 400 }
      );
    }
    if (!pickup_at) {
      return NextResponse.json(
        { error: "Faltan fecha y hora de recogida." },
        { status: 400 }
      );
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "El pedido no contiene artículos." },
        { status: 400 }
      );
    }
    if (payment_method !== "cash") {
      return NextResponse.json(
        { error: "Método de pago inválido para este endpoint." },
        { status: 400 }
      );
    }

    // Normalizamos y calculamos total (sin intentar insertar line_total_cents)
    const safeItems = items.map((it: any) => ({
      product_id: it.product_id ?? null,
      name: String(it.name ?? ""),
      unit_price_cents: Number(it.unit_price_cents ?? 0),
      quantity: Number(it.quantity ?? 0),
    }));

    const total_cents = safeItems.reduce(
      (acc, it) => acc + it.unit_price_cents * it.quantity,
      0
    );

    // 1) Crear pedido
    const { data: orderRow, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        customer_name,
        customer_phone,
        customer_email,
        notes,
        pickup_at, // ISO
        total_cents,
        status: "pending",
        payment_method: "cash",
        payment_status: "unpaid",
      })
      .select("id")
      .single();

    if (orderErr || !orderRow?.id) {
      return NextResponse.json(
        { error: orderErr?.message || "No se pudo crear el pedido." },
        { status: 500 }
      );
    }

    const order_id = orderRow.id as string;

    // 2) Insertar líneas
    // IMPORTANTE: no incluir 'line_total_cents' si es una columna generada en BD
    const itemsRows = safeItems.map((it) => ({
      order_id,
      product_id: it.product_id,
      name: it.name,
      unit_price_cents: it.unit_price_cents,
      quantity: it.quantity,
      // line_total_cents => lo calcula Postgres si la columna es GENERATED
    }));

    const { error: itemsErr } = await supabaseAdmin
      .from("order_items")
      .insert(itemsRows);

    if (itemsErr) {
      // rollback simple
      await supabaseAdmin.from("orders").delete().eq("id", order_id);
      return NextResponse.json(
        { error: itemsErr.message || "No se pudieron guardar las líneas." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, order_id }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
