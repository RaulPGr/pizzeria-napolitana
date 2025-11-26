// src/app/api/admin/orders/products/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { adminEmails } from '@/utils/plan';

// Devuelve productos y categorías para el panel admin (ProductsTable).
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

        // Guard: superadmin OR business member
    const cookieStore = await cookies();
    let isSuper=false, isMember=false; let userId: string | null = null;
    try {
      const supa = createServerClient(url, anon!, { cookies: { get:(n:string)=>cookieStore.get(n)?.value, set:(n:string,v:string,o:any)=>{ try{cookieStore.set({ name:n, value:v, ...o });}catch{} }, remove:(n:string,o:any)=>{ try{ cookieStore.set({ name:n, value:'', ...o, maxAge:0 }); }catch{} } } });
      const { data } = await supa.auth.getUser();
      userId = data.user?.id || null;
      const email = data.user?.email?.toLowerCase() || '';
      const admins = adminEmails();
      isSuper = admins.length === 0 ? !!email : admins.includes(email);
    } catch {}
    try {
      const slug = cookieStore.get('x-tenant-slug')?.value || '';
      if (slug && userId) {
        const { data: biz } = await supabaseAdmin.from('businesses').select('id').eq('slug', slug).maybeSingle();
        const bid = (biz as any)?.id as string | undefined;
        if (bid) {
          const { data: mm } = await supabaseAdmin.from('business_members').select('user_id').eq('business_id', bid).eq('user_id', userId).maybeSingle();
          isMember = !!mm;
        }
      }
    } catch {}
    if (!isSuper && !isMember) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // Determinar el negocio a partir del subdominio (cookie x-tenant-slug)
    const cookieStore2 = await cookies();
    const slug = cookieStore2.get('x-tenant-slug')?.value || '';
    let bid: string | null = null;
    if (slug) {
      const { data: biz } = await supabaseAdmin
        .from('businesses')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
      bid = (biz as any)?.id ?? null;
    }

    // Productos + nombre de categoría
    let prodQuery = admin
      .from(table)
      .select(
        'id, name, description, price, image_url, available, category_id, categories(name)'
      )
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });
    prodQuery = prodQuery.eq('active', true as any);
    if (bid) prodQuery = prodQuery.eq('business_id', bid);
    const { data: products, error } = await prodQuery;
    if (error) throw error;

    // Categorías para el <select/>
    let catQuery = admin
      .from('categories')
      .select('id, name')
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });
    if (bid) catQuery = catQuery.eq('business_id', bid);
    const { data: categories, error: catErr } = await catQuery;
    if (catErr) throw catErr;

    // Días por producto (para edición en modo menú diario)
    const prodIds = (products || []).map((p: any) => p.id);
    const { data: weekdaysRows, error: wdErr } = await admin
      .from('product_weekdays')
      .select('product_id, day')
      .in('product_id', prodIds.length > 0 ? prodIds : [-1]);
    if (wdErr) throw wdErr;
    const weekdays: Record<number, number[]> = {};
    (weekdaysRows || []).forEach((r: any) => {
      const pid = Number(r.product_id);
      const d = Number(r.day);
      if (!weekdays[pid]) weekdays[pid] = [];
      weekdays[pid].push(d);
    });

    return NextResponse.json({ products, categories, weekdays });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}

