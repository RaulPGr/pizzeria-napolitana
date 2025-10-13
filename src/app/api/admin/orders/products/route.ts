// src/app/api/admin/orders/products/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const table = process.env.NEXT_PUBLIC_PRODUCTS_TABLE || 'products';
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // Productos + nombre de categoría
    const { data: products, error } = await admin
      .from(table)
      .select(
        'id, name, description, price, image_url, available, category_id, categories(name)'
      )
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });
    if (error) throw error;

    // Categorías para el <select/>
    const { data: categories, error: catErr } = await admin
      .from('categories')
      .select('id, name')
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });
    if (catErr) throw catErr;

    return NextResponse.json({ products, categories });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}
