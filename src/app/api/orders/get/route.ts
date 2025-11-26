// src/app/api/orders/get/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !service) throw new Error("Faltan variables de entorno de Supabase.");
  return createClient(url, service, { auth: { persistSession: false } });
}

// Devuelve un pedido completo (con items) para mostrarlo al cliente y al panel.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Falta parámetro id" }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Cabecera del pedido.
    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id, created_at, customer_name, customer_phone, pickup_at, status, payment_method, payment_status, total_cents, admin_notes"
      )
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!order) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    // Líneas del pedido; añadimos posteriormente las opciones seleccionadas.
    const { data: items, error: e2 } = await supabase
      .from("order_items")
      .select(
        "order_id, product_id, name, quantity, unit_price_cents, line_total_cents, order_item_options ( name_snapshot, group_name_snapshot, price_delta_snapshot )"
      )
      .eq("order_id", id);

    if (e2) throw e2;

    // Normalizamos la respuesta para incluir los toppings legibles.
    const normalizedItems =
      (items || []).map((item) => ({
        order_id: item.order_id,
        product_id: item.product_id,
        name: item.name,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        line_total_cents: item.line_total_cents,
        options: Array.isArray((item as any)?.order_item_options)
          ? (item as any).order_item_options.map((opt: any) => ({
              name: opt.name_snapshot,
              groupName: opt.group_name_snapshot,
              priceDelta: typeof opt.price_delta_snapshot === "number" ? opt.price_delta_snapshot : null,
            }))
          : [],
      })) ?? [];

    return NextResponse.json({ order: { ...order, items: normalizedItems } });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Error" },
      { status: 500 }
    );
  }
}
