// /src/app/api/stripe/resolve/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sid = searchParams.get("sid") || "";
  if (!sid) return NextResponse.json({ error: "Missing sid" }, { status: 400 });

  const { data, error } = await supabase
    .from("orders")
    .select("id")
    .eq("stripe_session_id", sid)
    .single();

  if (error || !data) return NextResponse.json({ found: false });
  return NextResponse.json({ found: true, order_id: data.id });
}
