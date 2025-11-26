// src/app/api/admin/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { adminEmails } from '@/utils/plan';

export const dynamic = 'force-dynamic';

// Estructura enviada al frontend (mismos campos que muestra la vista de estadísticas).
type Dataset = {
  ordersCount: number;
  deliveredCount: number;
  cancelledCount: number;
  revenueCents: number;
  aovCents: number;
  topProducts: Array<{ key: string; name: string; qty: number; cents: number }>;
  worstProducts: Array<{ key: string; name: string; qty: number; cents: number }>;
  byWeekday: Array<{ weekday: number; cents: number; count: number }>;
  byHour: Array<{ hour: number; cents: number; count: number }>;
  customers: Array<{ key: string; name: string; count: number; cents: number; avgCents: number }>;
  newVsReturning: { newCount: number; returningCount: number };
  monthly: Array<{ ym: string; cents: number; count: number }>;
  byCategory: Array<{ id: number | 'nocat'; name: string; cents: number; qty: number }>;
};

// Calcula estadísticas por negocio (pedidos, ingresos, productos, etc.).
export async function GET(req: NextRequest) {
  try {
    // Guard: requiere sesión admin o ser miembro del negocio
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const cookieStore = await cookies();
      const supa = createServerClient(url, anon, {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set(name: string, value: string, options: any) { cookieStore.set({ name, value, ...options }); },
          remove(name: string, options: any) { cookieStore.set({ name, value: '', ...options }); },
        },
      });
      const { data } = await supa.auth.getUser();
      const email = data.user?.email?.toLowerCase() || '';
      const admins = adminEmails();
      const isSuper = admins.length === 0 ? !!email : admins.includes(email);

      // Miembro del negocio del subdominio
      let isMember = false;
      try {
        let slug = cookieStore.get('x-tenant-slug')?.value || '';
        if (!slug) {
          // permite ?tenant=
          const { searchParams } = new URL(req.url);
          slug = (searchParams.get('tenant') || '').toLowerCase();
        }
        if (slug && data.user?.id) {
          const { data: biz } = await supabaseAdmin.from('businesses').select('id').eq('slug', slug).maybeSingle();
          const bid = (biz as any)?.id as string | undefined;
          if (bid) {
            const { data: mm } = await supabaseAdmin
              .from('business_members')
              .select('user_id')
              .eq('business_id', bid)
              .eq('user_id', data.user.id)
              .maybeSingle();
            isMember = !!mm;
          }
        }
      } catch {}

      const ok = isSuper || isMember;
      if (!ok) { return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 }); }
    } catch {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // 1) base orders in range (limitado por negocio del subdominio)
    const cookieStore = await cookies();
    let slug = cookieStore.get('x-tenant-slug')?.value || '';
    if (!slug) {
      // Fallback: permitir ?tenant=slug para entornos donde la cookie no esté presente
      slug = (searchParams.get('tenant') || '').toLowerCase();
    }
    let bid: string | null = null;
    if (slug) {
      const { data: biz } = await supabaseAdmin
        .from('businesses')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
      bid = (biz as any)?.id ?? null;
    }

    let q = supabaseAdmin
      .from('orders')
      .select('id, status, total_cents, created_at, customer_name, customer_phone')
      .order('created_at', { ascending: true });
    if (from) q = q.gte('created_at', new Date(from).toISOString());
    if (to) q = q.lte('created_at', new Date(to).toISOString());
    if (bid) q = q.eq('business_id', bid);
    const { data: orders, error: eOrders } = await q;
    if (eOrders) throw eOrders;

    const orderIds = (orders || []).map((o: any) => o.id);

    // 2) items for those orders
    let items: any[] = [];
    if (orderIds.length > 0) {
      let itQuery = supabaseAdmin
        .from('order_items')
        .select('order_id, product_id, name, quantity, line_total_cents');
      if (bid) itQuery = itQuery.eq('business_id', bid);
      itQuery = itQuery.in('order_id', orderIds);
      const { data: it, error: eItems } = await itQuery;
      if (eItems) throw eItems;
      items = it || [];
    }

    // 3) products + categories mapping
    let prodQ = supabaseAdmin.from('products').select('id, name, category_id');
    let catQ = supabaseAdmin.from('categories').select('id, name');
    if (bid) { prodQ = prodQ.eq('business_id', bid); catQ = catQ.eq('business_id', bid); }
    const { data: products } = await prodQ;
    const { data: categories } = await catQ;
    const catMap = new Map((categories || []).map((c: any) => [c.id, c.name] as const));

    // -------------- aggregates --------------
    const delivered = (orders || []).filter((o: any) => o.status === 'delivered');
    const cancelled = (orders || []).filter((o: any) => o.status === 'cancelled');
    const revenueCents = delivered.reduce((acc: number, o: any) => acc + (o.total_cents || 0), 0);
    const aovCents = delivered.length ? Math.round(revenueCents / delivered.length) : 0;

    // products aggregation (only delivered)
    const deliveredSet = new Set(delivered.map((o: any) => o.id));
    const prodAgg = new Map<string, { name: string; qty: number; cents: number }>();
    for (const it of items) {
      if (!deliveredSet.has(it.order_id)) continue;
      const key = String(it.product_id ?? it.name);
      const name = String(it.name || 'Producto');
      const prev = prodAgg.get(key) || { name, qty: 0, cents: 0 };
      prev.qty += Number(it.quantity || 0);
      prev.cents += Number(it.line_total_cents || 0);
      prodAgg.set(key, prev);
    }
    const topProducts = Array.from(prodAgg.entries())
      .map(([key, v]) => ({ key, name: v.name, qty: v.qty, cents: v.cents }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
    const worstProducts = Array.from(prodAgg.entries())
      .map(([key, v]) => ({ key, name: v.name, qty: v.qty, cents: v.cents }))
      .sort((a, b) => a.qty - b.qty)
      .slice(0, 5);

    // weekday/hour
    const byWeekday = Array.from({ length: 7 }, (_, i) => ({ weekday: i, cents: 0, count: 0 }));
    const byHour = Array.from({ length: 24 }, (_, i) => ({ hour: i, cents: 0, count: 0 }));
    for (const o of delivered) {
      const d = new Date(o.created_at);
      const wd = d.getDay();
      const hr = d.getHours();
      const cents = o.total_cents || 0;
      byWeekday[wd].cents += cents; byWeekday[wd].count += 1;
      byHour[hr].cents += cents; byHour[hr].count += 1;
    }

    // customers
    const custAgg = new Map<string, { name: string; count: number; cents: number }>();
    for (const o of delivered) {
      const key = (o.customer_phone || o.customer_name || 'n/a') as string;
      const prev = custAgg.get(key) || { name: o.customer_name || key, count: 0, cents: 0 };
      prev.count += 1; prev.cents += o.total_cents || 0; custAgg.set(key, prev);
    }
    const customers = Array.from(custAgg.entries())
      .map(([key, v]) => ({ key, name: v.name, count: v.count, cents: v.cents, avgCents: v.count ? Math.round(v.cents / v.count) : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
    // new vs returning within dataset
    const newVsReturning = { newCount: 0, returningCount: 0 };
    for (const v of custAgg.values()) { if (v.count <= 1) newVsReturning.newCount++; else newVsReturning.returningCount++; }

    // monthly series (YYYY-MM)
    const monthlyMap = new Map<string, { cents: number; count: number }>();
    for (const o of delivered) {
      const ym = new Date(o.created_at).toISOString().slice(0, 7);
      const prev = monthlyMap.get(ym) || { cents: 0, count: 0 };
      prev.cents += o.total_cents || 0; prev.count += 1; monthlyMap.set(ym, prev);
    }
    const monthly = Array.from(monthlyMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([ym, v]) => ({ ym, cents: v.cents, count: v.count }));

    // by category (using products map)
    const prodMap = new Map((products || []).map((p: any) => [p.id, p] as const));
    const catAgg = new Map<number | 'nocat', { name: string; cents: number; qty: number }>();
    for (const it of items) {
      if (!deliveredSet.has(it.order_id)) continue;
      const prod = prodMap.get(it.product_id);
      const catId: number | 'nocat' = prod?.category_id ?? 'nocat';
      const catName = catId === 'nocat' ? 'Otros' : (catMap.get(catId as number) || 'Sin categoría');
      const prev = catAgg.get(catId) || { name: catName, cents: 0, qty: 0 };
      prev.cents += Number(it.line_total_cents || 0); prev.qty += Number(it.quantity || 0);
      catAgg.set(catId, prev);
    }
    const byCategory = Array.from(catAgg.entries()).map(([id, v]) => ({ id, name: v.name, cents: v.cents, qty: v.qty }));

    const payload: Dataset = {
      ordersCount: orders?.length || 0,
      deliveredCount: delivered.length,
      cancelledCount: cancelled.length,
      revenueCents,
      aovCents,
      topProducts,
      worstProducts,
      byWeekday,
      byHour,
      customers,
      newVsReturning,
      monthly,
      byCategory,
    };

    return NextResponse.json({ ok: true, data: payload });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err?.message || 'Error generando estadísticas' }, { status: 500 });
  }
}
