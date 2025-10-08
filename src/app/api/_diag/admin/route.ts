import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supa = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await supa.from("products").select("id").limit(1);

  return NextResponse.json({
    ok: !error,
    error: error?.message ?? null,
    sampleCount: data?.length ?? 0,
  });
}
