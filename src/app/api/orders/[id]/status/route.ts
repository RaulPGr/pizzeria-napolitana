// src/app/api/orders/[id]/status/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin"; // helper de Service Role

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  try {
    const id = params.id;
    const { status } = await req.json();

    const allowed = ["pending", "confirmed", "preparing", "ready", "delivered", "cancelled"];
    if (!allowed.includes(status)) {
      return NextResponse.json({ ok: false, message: "Estado inválido" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("orders").update({ status }).eq("id", id);
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, message: "Error actualizando estado" }, { status: 500 });
  }
}
