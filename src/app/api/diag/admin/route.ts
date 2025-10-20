// src/app/api/_diag/admin/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!; // clave de servicio (solo servidor)

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function GET() {
  try {
    // Probamos una tabla que ya sabemos que funciona (products)
    const { data: products, error: pErr } = await supabase
      .from("products")
      .select("id,name")
      .limit(3);

    // Y probamos orders, que suele ser lo que pinta el /admin
    const { data: orders, error: oErr } = await supabase
      .from("orders")
      .select("id,status,created_at")
      .order("id", { ascending: false })
      .limit(5);

    return NextResponse.json({
      ok: true,
      hasUrl: Boolean(url),
      hasServiceRole: Boolean(key),
      productsSample: products ?? null,
      productsError: pErr?.message ?? null,
      ordersSample: orders ?? null,
      ordersError: oErr?.message ?? null,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        message: e?.message ?? String(e),
        stack: e?.stack ?? null,
      },
      { status: 500 }
    );
  }
}

