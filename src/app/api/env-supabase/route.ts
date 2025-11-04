// src/app/api/env-supabase/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    let host = '';
    try { host = new URL(rawUrl).host; } catch {}
    return NextResponse.json({
      ok: true,
      vercelEnv: process.env.VERCEL_ENV || 'unknown',
      supabaseUrlHost: host || null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Error' }, { status: 500 });
  }
}

