import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,   // clave de servicio
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  try {
    const { id, status } = await req.json() as { id?: string; status?: string };

    if (!id || !status) {
      return NextResponse.json(
        { error: "Faltan id o status" },
        { status: 400 }
      );
    }

    // Solo permitimos estos 4 estados
    const ALLOWED = ["pendiente", "listo", "entregado", "cancelado"];
    if (!ALLOWED.includes(status)) {
      return NextResponse.json({ error: "Estado no permitido" }, { status: 400 });
    }

    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Error" }, { status: 500 });
  }
}
