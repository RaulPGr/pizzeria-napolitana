// src/app/api/orders/get/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !service) throw new Error("Faltan variables de entorno de Supabase.");
  return createClient(url, service, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Falta parámetro id" }, { status: 400 });
    }

    const supabase = getAdminClient();

    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id, created_at, customer_name, customer_phone, pickup_at, status, payment_method, payment_status, total_cents, admin_notes"
      )
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!order) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const { data: items, error: e2 } = await supabase
      .from("order_items")
      .select(
        "order_id, product_id, name, quantity, unit_price_cents, line_total_cents"
      )
      .eq("order_id", id);

    if (e2) throw e2;

    return NextResponse.json({ order: { ...order, items: items ?? [] } });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Error" },
      { status: 500 }
    );
  }
}
