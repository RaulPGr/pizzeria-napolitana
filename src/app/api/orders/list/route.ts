// src/app/api/orders/list/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

type Order = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  pickup_at: string | null;
  status: string;
  payment_method: "CASH" | "CARD" | "BIZUM";
  payment_status: "pending" | "paid" | "refunded" | "failed";
  total_cents: number;
  admin_notes?: string | null;
};

type OrderItem = {
  order_id: string;
  product_id: number | string | null;
  name: string | null;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number | null;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const windowKey = (searchParams.get("window") ?? "7d") as "today" | "7d" | "30d" | "all";

    const sb = admin();
    const now = new Date();
    let fromISO: string | null = null;
    if (windowKey === "today") {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      fromISO = d.toISOString();
    } else if (windowKey === "7d") {
      const d = new Date(now); d.setDate(d.getDate() - 7); fromISO = d.toISOString();
    } else if (windowKey === "30d") {
      const d = new Date(now); d.setDate(d.getDate() - 30); fromISO = d.toISOString();
    }

    // Activos = no entregados/cancelados
    let qActive = sb
      .from("orders")
      .select("id, created_at, customer_name, customer_phone, pickup_at, status, payment_method, payment_status, total_cents, admin_notes")
      .neq("status", "entregado")
      .neq("status", "cancelado")
      .order("created_at", { ascending: false });

    // Completados = entregados o cancelados
    let qCompleted = sb
      .from("orders")
      .select("id, created_at, customer_name, customer_phone, pickup_at, status, payment_method, payment_status, total_cents, admin_notes")
      .in("status", ["entregado", "cancelado"])
      .order("created_at", { ascending: false });

    if (fromISO) { qActive = qActive.gte("created_at", fromISO); qCompleted = qCompleted.gte("created_at", fromISO); }

    const [{ data: act, error: e1 }, { data: comp, error: e2 }] = await Promise.all([qActive, qCompleted]);
    if (e1) throw e1; if (e2) throw e2;

    const filterCard = (o: Order) => (o.payment_method !== "CARD") || (o.payment_status === "paid");
    const active = (act ?? []).filter(filterCard);
    const completed = (comp ?? []).filter(filterCard);

    const ids = [...active, ...completed].map(o => o.id);
    if (ids.length === 0) return NextResponse.json({ active: [], completed: [] });

    const { data: items, error: e3 } = await sb
      .from("order_items")
      .select("order_id, product_id, name, quantity, unit_price_cents, line_total_cents")
      .in("order_id", ids);
    if (e3) throw e3;

    const byOrder = new Map<string, OrderItem[]>();
    (items ?? []).forEach(it => {
      const list = byOrder.get(it.order_id) ?? [];
      list.push(it as OrderItem);
      byOrder.set(it.order_id, list);
    });

    const attach = (arr: Order[]) => arr.map(o => ({ ...o, items: byOrder.get(o.id) ?? [] }));
    return NextResponse.json({ active: attach(active), completed: attach(completed) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
