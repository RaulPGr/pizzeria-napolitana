// src/app/api/products/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // aseguramos Node runtime

// ⚠️ Ajusta estos nombres si tus env son distintos
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Tu tabla real en Supabase según tu captura
const TABLE = "productos";

/**
 * Construye el cliente de Supabase validando envs.
 */
function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * GET /api/products
 *   - ?active=1 filtra por activos
 *   - ?debug=1 devuelve info de diagnóstico
 */
export async function GET(req: NextRequest) {
  try {
    // 👇 Usamos un nombre local para evitar cualquier sombra de "URL"
    const urlObj = new globalThis.URL(req.url);
    const params = urlObj.searchParams;

    // Modo diagnóstico
    if (params.get("debug") === "1") {
      return NextResponse.json({
        ok: true,
        usingTable: TABLE,
        urlOk: Boolean(SUPABASE_URL),
        anonKeyOk: Boolean(SUPABASE_ANON_KEY),
        urlPrefix: SUPABASE_URL.slice(0, 36) + "...",
        anonPrefix: SUPABASE_ANON_KEY.slice(0, 10) + "...",
      });
    }

    const supabase = getSupabase();

    // Base query
    let query = supabase
      .from(TABLE)
      .select(
        // Campos reales de tu tabla (según tu captura)
        "id,nombre,precio,descripcion,imagen,categoria,stock,activo"
      )
      .order("categoria", { ascending: true })
      .order("id", { ascending: true });

    // Filtro opcional /api/products?active=1
    const activeParam = params.get("active");
    if (activeParam === "1" || activeParam === "true") {
      query = query.eq("activo", true);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Mapeo a la forma que usa el frontend (name/price/...)
    const products = (data ?? []).map((r: any) => ({
      id: r.id,
      name: r.nombre ?? "",
      price: Number(r.precio ?? 0),
      description: r.descripcion ?? "",
      image: r.imagen ?? "",
      category: r.categoria ?? "",
      stock: r.stock ?? 0,
      active: Boolean(r.activo),
    }));

    return NextResponse.json({ products });
  } catch (err: any) {
    console.error("GET /api/products error:", err);
    const message = err?.message || String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
