import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// servicio (solo en el servidor)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // <- clave de servicio, nunca en el cliente
  { auth: { persistSession: false } }
);

export async function GET(
  _req: Request,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params;

    const { data, error } = await supabase
      .from("order_items")
      .select("product_id,name,quantity,unit_price_cents,line_total_cents")
      .eq("order_id", orderId)
      .order("id", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ items: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Error" }, { status: 500 });
  }
}
