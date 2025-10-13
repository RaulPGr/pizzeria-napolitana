// src/app/api/admin/orders/products/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { adminEmails } from '@/utils/plan';

export async function GET() {
  try {
    const table = process.env.NEXT_PUBLIC_PRODUCTS_TABLE || 'products';
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
        { status: 500 }
      );
    }

    // Guard: requiere sesión de admin
    try {
      const cookieStore = await cookies();
      const supa = createServerClient(url, anon!, {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set(name: string, value: string, options: any) { cookieStore.set({ name, value, ...options }); },
          remove(name: string, options: any) { cookieStore.set({ name, value: '', ...options }); },
        },
      });
      const { data } = await supa.auth.getUser();
      const email = data.user?.email?.toLowerCase() || '';
      if (!adminEmails().includes(email)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
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
