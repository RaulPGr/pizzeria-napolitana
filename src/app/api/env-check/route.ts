// src/app/api/env-check/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";        // fuerza runtime Node (no Edge)
export const dynamic = "force-dynamic"; // evita caché/prerender

export async function GET() {
  return NextResponse.json({
    ok: true,
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasAnon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
