import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { adminEmails } from '@/utils/plan';

async function getTenantSlug(): Promise<string> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get('x-tenant-slug')?.value || '';
  } catch {
    return '';
  }
}

async function assertAdminOrMember() {
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
    const userId = data.user?.id || null;
    const admins = adminEmails();
    let allowed = admins.length === 0 ? !!email : admins.includes(email);
    if (!allowed && userId) {
      try {
        const slug = cookieStore.get('x-tenant-slug')?.value || '';
        if (slug) {
          const { data: biz } = await supabaseAdmin.from('businesses').select('id').eq('slug', slug).maybeSingle();
          const bid = (biz as any)?.id as string | undefined;
          if (bid) {
            const { data: mm } = await supabaseAdmin
              .from('business_members')
              .select('user_id')
              .eq('business_id', bid)
              .eq('user_id', userId)
              .maybeSingle();
            allowed = !!mm;
          }
        }
      } catch {}
    }
    if (!allowed) {
      return { ok: false as const, res: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) };
    }
    return { ok: true as const, userId };
  } catch {
    return { ok: false as const, res: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) };
  }
}

async function getBusinessIdBySlug(slug: string) {
  if (!slug) return null;
  const { data } = await supabaseAdmin.from('businesses').select('id').eq('slug', slug).maybeSingle();
  return (data as any)?.id ?? null;
}

async function assertProductBelongs(productId: number, businessId: string) {
  const { data } = await supabaseAdmin
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('business_id', businessId)
    .maybeSingle();
  if (!data) throw new Error('Producto no encontrado');
}

async function assertGroupBelongs(groupId: string, businessId: string) {
  const { data } = await supabaseAdmin
    .from('option_groups')
    .select('id')
    .eq('id', groupId)
    .eq('business_id', businessId)
    .maybeSingle();
  if (!data) throw new Error('Grupo no encontrado');
}

export async function GET(req: Request) {
  const auth = await assertAdminOrMember();
  if (!auth.ok) return auth.res;
  const slug = await getTenantSlug();
  const bid = await getBusinessIdBySlug(slug);
  if (!bid) return NextResponse.json({ ok: false, error: 'Negocio no encontrado' }, { status: 400 });
  const url = new URL(req.url);
  const productId = Number(url.searchParams.get('productId'));
  if (!Number.isFinite(productId)) return NextResponse.json({ ok: false, error: 'productId requerido' }, { status: 400 });
  try {
    await assertProductBelongs(productId, bid);
    const { data, error } = await supabaseAdmin
      .from('product_option_groups')
      .select('id, group_id, option_groups(id, name, description, selection_type, min_select, max_select, is_required)')
      .eq('product_id', productId)
      .order('id', { ascending: true });
    if (error) throw error;
    const assigned = (data || []).map((row) => ({
      id: row.id,
      group: row.option_groups,
    }));
    return NextResponse.json({ ok: true, assigned });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'No se pudieron cargar las asignaciones' }, { status: 400 });
  }
}

export async function POST(req: Request) {
  const auth = await assertAdminOrMember();
  if (!auth.ok) return auth.res;
  const slug = await getTenantSlug();
  const bid = await getBusinessIdBySlug(slug);
  if (!bid) return NextResponse.json({ ok: false, error: 'Negocio no encontrado' }, { status: 400 });
  let body: any = null;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }
  const productId = Number(body?.product_id);
  const groupId = String(body?.group_id || '').trim();
  if (!Number.isFinite(productId) || !groupId) return NextResponse.json({ ok: false, error: 'Datos incompletos' }, { status: 400 });
  try {
    await Promise.all([
      assertProductBelongs(productId, bid),
      assertGroupBelongs(groupId, bid),
    ]);
    const { data: existing } = await supabaseAdmin
      .from('product_option_groups')
      .select('id')
      .eq('product_id', productId)
      .eq('group_id', groupId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ ok: true, id: existing.id, info: 'Ya estaba asignado' });
    }
    const { data, error } = await supabaseAdmin
      .from('product_option_groups')
      .insert({ product_id: productId, group_id: groupId })
      .select('id')
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, id: (data as any)?.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'No se pudo asignar el grupo' }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const auth = await assertAdminOrMember();
  if (!auth.ok) return auth.res;
  const slug = await getTenantSlug();
  const bid = await getBusinessIdBySlug(slug);
  if (!bid) return NextResponse.json({ ok: false, error: 'Negocio no encontrado' }, { status: 400 });
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const productIdParam = url.searchParams.get('productId');
  const groupIdParam = url.searchParams.get('groupId');
  if (!id && !(productIdParam && groupIdParam)) {
    return NextResponse.json({ ok: false, error: 'Debe enviar id o productId+groupId' }, { status: 400 });
  }
  try {
    if (id) {
      const { data: toDelete } = await supabaseAdmin
        .from('product_option_groups')
        .select('product_id, group_id')
        .eq('id', id)
        .maybeSingle();
      if (!toDelete) throw new Error('Asignación no encontrada');
      await Promise.all([
        assertProductBelongs(Number((toDelete as any).product_id), bid),
        assertGroupBelongs((toDelete as any).group_id, bid),
      ]);
      const { error } = await supabaseAdmin
        .from('product_option_groups')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } else {
      const productId = Number(productIdParam);
      const groupId = String(groupIdParam);
      await Promise.all([
        assertProductBelongs(productId, bid),
        assertGroupBelongs(groupId, bid),
      ]);
      const { error } = await supabaseAdmin
        .from('product_option_groups')
        .delete()
        .eq('product_id', productId)
        .eq('group_id', groupId);
      if (error) throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'No se pudo eliminar la asignación' }, { status: 400 });
  }
}
