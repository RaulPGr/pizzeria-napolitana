// src/app/api/orders/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';

async function getTenantSlug(): Promise<string> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get('x-tenant-slug')?.value || '';
  } catch { return ''; }
}

async function getBusinessIdBySlug(slug: string): Promise<string | null> {
  if (!slug) return null;
  const { data } = await supabaseAdmin
    .from('businesses')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  return (data as any)?.id ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const status = (searchParams.get('status') || 'all').toLowerCase();

    // SELECT orders + order_items con los nombres de columnas de tu esquema
    let query = supabaseAdmin
      .from('orders')
      .select(
        `
        id,
        code,
        customer_name,
        customer_phone,
        customer_email,
        notes,
        pickup_at,
        status,
        total_cents,
        payment_method,
        payment_status,
        created_at,
        order_items:order_items (
          id,
          product_id,
          name,
          unit_price_cents,
          quantity,
          line_total_cents,
          created_at
        )
      `
      )
      .order('created_at', { ascending: false });

    // Limitar por negocio del subdominio
    try {
      const slug = await getTenantSlug();
      const bid = await getBusinessIdBySlug(slug);
      if (bid) query = query.eq('business_id', bid);
    } catch {}

    if (q) {
      // nombre, teléfono o código
      query = query.or(
        `customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%,code.ilike.%${q}%`
      );
    }

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query.limit(200);
    if (error) throw error;

    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: err?.message || 'Error listando pedidos' },
      { status: 500 }
    );
  }
}
