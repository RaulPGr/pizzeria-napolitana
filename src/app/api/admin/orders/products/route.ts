// src/app/api/admin/orders/products/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  try {
    const table = process.env.NEXT_PUBLIC_PRODUCTS_TABLE || 'products';

    // Productos + nombre de categoría
    const { data: products, error } = await supabaseAdmin
      .from(table)
      .select(
        'id, name, description, price, image_url, available, category_id, categories(name)'
      )
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });
    if (error) throw error;

    // Categorías para el <select/>
    const { data: categories, error: catErr } = await supabaseAdmin
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

