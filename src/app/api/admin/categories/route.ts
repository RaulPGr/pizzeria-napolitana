// src/app/api/admin/categories/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { adminEmails } from '@/utils/plan';

// Helpers compartidos para identificar el negocio en el panel admin.
async function getTenantSlug(): Promise<string> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get('x-tenant-slug')?.value || '';
  } catch {
    return '';
  }
}

async function assertAdminOrMember(): Promise<{ ok: true } | { ok: false; res: Response }> {
  try {
    const cookieStore = await cookies();
    const supa = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (n: string) => cookieStore.get(n)?.value,
          set: (n: string, v: string, o: any) => { try { cookieStore.set({ name: n, value: v, ...o }); } catch {} },
          remove: (n: string, o: any) => { try { cookieStore.set({ name: n, value: '', ...o, maxAge: 0 }); } catch {} },
        },
      }
    );
    const { data } = await supa.auth.getUser();
    const email = data.user?.email?.toLowerCase() || '';
    const uid = data.user?.id || '';
    const admins = adminEmails();
    let allowed = admins.length === 0 ? !!email : admins.includes(email);
    if (!allowed) {
      try {
        const slug = cookieStore.get('x-tenant-slug')?.value || '';
        if (slug && uid) {
          const { data: biz } = await supabaseAdmin.from('businesses').select('id').eq('slug', slug).maybeSingle();
          const bid = (biz as any)?.id as string | undefined;
          if (bid) {
            const { data: mm } = await supabaseAdmin
              .from('business_members')
              .select('user_id')
              .eq('business_id', bid)
              .eq('user_id', uid)
              .maybeSingle();
            allowed = !!mm;
          }
        }
      } catch {}
    }
    if (!allowed) return { ok: false, res: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) };
    return { ok: true };
  } catch {
    return { ok: false, res: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) };
  }
}

async function getBusinessIdBySlug(slug: string): Promise<string | null> {
  if (!slug) return null;
  const { data, error } = await supabaseAdmin.from('businesses').select('id').eq('slug', slug).maybeSingle();
  if (error) return null;
  return (data as any)?.id ?? null;
}

// Devuelve todas las categorías del negocio para el panel de productos.
export async function GET() {
  const auth = await assertAdminOrMember();
  if (!auth.ok) return auth.res;
  const slug = await getTenantSlug();
  const bid = await getBusinessIdBySlug(slug);
  if (!bid) return NextResponse.json({ ok: true, categories: [] });
  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('*')
    .eq('business_id', bid)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, categories: data || [] });
}

// Crea una nueva categoría (nombre + sort optional).
export async function POST(req: Request) {
  const auth = await assertAdminOrMember();
  if (!auth.ok) return auth.res;
  const slug = await getTenantSlug();
  const bid = await getBusinessIdBySlug(slug);
  if (!bid) return NextResponse.json({ ok: false, error: 'Negocio no encontrado' }, { status: 400 });
  let body: any = null; try { body = await req.json(); } catch {}
  const name = String(body?.name || '').trim();
  const sort_order = body?.sort_order == null ? null : Number(body.sort_order);
  if (!name) return NextResponse.json({ ok: false, error: 'Nombre requerido' }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from('categories')
    .insert({ name, sort_order, business_id: bid })
    .select('id')
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: (data as any)?.id });
}

export async function PATCH(req: Request) {
  const auth = await assertAdminOrMember();
  if (!auth.ok) return auth.res;
  const slug = await getTenantSlug();
  const bid = await getBusinessIdBySlug(slug);
  if (!bid) return NextResponse.json({ ok: false, error: 'Negocio no encontrado' }, { status: 400 });
  let body: any = null; try { body = await req.json(); } catch {}
  const id = Number(body?.id);
  if (!id) return NextResponse.json({ ok: false, error: 'id requerido' }, { status: 400 });
  const updates: any = {};
  if (typeof body?.name === 'string') updates.name = String(body.name).trim();
  if (body?.sort_order != null) updates.sort_order = Number(body.sort_order);
  if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true });
  const { error } = await supabaseAdmin
    .from('categories')
    .update(updates)
    .eq('id', id)
    .eq('business_id', bid);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const auth = await assertAdminOrMember();
  if (!auth.ok) return auth.res;
  const slug = await getTenantSlug();
  const bid = await getBusinessIdBySlug(slug);
  if (!bid) return NextResponse.json({ ok: false, error: 'Negocio no encontrado' }, { status: 400 });
  const url = new URL(req.url);
  const id = Number(url.searchParams.get('id')) || Number((await req.text()).trim());
  if (!id) return NextResponse.json({ ok: false, error: 'id requerido' }, { status: 400 });

  // Bloquear solo si hay productos ACTIVOS en la categoría
  const { count } = await supabaseAdmin
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', bid)
    .eq('category_id', id)
    .eq('active', true as any);
  if ((count || 0) > 0) {
    return NextResponse.json({ ok: false, error: 'No se puede eliminar: hay productos en esta categoría' }, { status: 409 });
  }

  // Desasociar productos INACTIVOS para evitar restricciones de FK
  try {
    await supabaseAdmin
      .from('products')
      .update({ category_id: null })
      .eq('business_id', bid)
      .eq('category_id', id)
      .eq('active', false as any);
  } catch {}

  const { error } = await supabaseAdmin
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('business_id', bid);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
