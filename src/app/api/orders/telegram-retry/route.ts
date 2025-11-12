import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notifyOrderViaTelegram } from "@/lib/order-telegram-notify";

const MAX_BATCH = 10;

export async function POST(req: NextRequest) {
  const expected = process.env.TELEGRAM_RETRY_TOKEN;
  const url = new URL(req.url);
  const provided = url.searchParams.get("token") || req.headers.get("x-telegram-retry-token") || "";

  if (!expected) {
    return NextResponse.json(
      { ok: false, message: "Var TELEGRAM_RETRY_TOKEN no configurada" },
      { status: 500 }
    );
  }
  if (provided !== expected) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id")
    .is("telegram_notified_at", null)
    .lt("telegram_notify_errors", 5)
    .order("created_at", { ascending: true })
    .limit(MAX_BATCH);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of data || []) {
    const result = await notifyOrderViaTelegram(row.id);
    if (result.ok) sent += 1;
    else if (result.skip) skipped += 1;
    else failed += 1;
  }

  return NextResponse.json({
    ok: true,
    processed: data?.length || 0,
    sent,
    skipped,
    failed,
  });
}
