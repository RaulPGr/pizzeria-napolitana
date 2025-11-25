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

async function assertGroupBelongsToBusiness(groupId: string, businessId: string) {
  const { data } = await supabaseAdmin
    .from('option_groups')
    .select('id')
    .eq('id', groupId)
    .eq('business_id', businessId)
    .maybeSingle();
  if (!data) throw new Error('Grupo no encontrado');
}

function sanitizeOptionPayload(body: any) {
  const name = String(body?.name || '').trim();
  if (!name) throw new Error('Nombre requerido');
  const price = body?.price_delta == null || body.price_delta === '' ? 0 : Number(body.price_delta);
  if (!Number.isFinite(price)) throw new Error('Precio adicional inválido');
  const sort = body?.sort_order == null || body.sort_order === '' ? 0 : Number(body.sort_order);
  if (!Number.isFinite(sort)) throw new Error('Orden inválido');
  return { name, price_delta: price, sort_order: sort };
}

export async function GET(req: Request) {
  const auth = await assertAdminOrMember();
  if (!auth.ok) return auth.res;
  const slug = await getTenantSlug();
  const bid = await getBusinessIdBySlug(slug);
  if (!bid) return NextResponse.json({ ok: false, error: 'Negocio no encontrado' }, { status: 400 });
  const url = new URL(req.url);
  const groupId = url.searchParams.get('groupId') || '';
  if (!groupId) return NextResponse.json({ ok: false, error: 'groupId requerido' }, { status: 400 });
  try {
    await assertGroupBelongsToBusiness(groupId, bid);
    const { data, error } = await supabaseAdmin
      .from('options')
      .select('id, name, price_delta, sort_order, created_at')
      .eq('group_id', groupId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ ok: true, options: data || [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'No se pudieron cargar las opciones' }, { status: 400 });
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
  const groupId = String(body?.group_id || '').trim();
  if (!groupId) return NextResponse.json({ ok: false, error: 'group_id requerido' }, { status: 400 });
  try {
    await assertGroupBelongsToBusiness(groupId, bid);
    const payload = sanitizeOptionPayload(body);
    const { data, error } = await supabaseAdmin
      .from('options')
      .insert({ ...payload, group_id: groupId })
      .select('id')
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, id: (data as any)?.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'No se pudo crear la opción' }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const auth = await assertAdminOrMember();
  if (!auth.ok) return auth.res;
  const slug = await getTenantSlug();
  const bid = await getBusinessIdBySlug(slug);
  if (!bid) return NextResponse.json({ ok: false, error: 'Negocio no encontrado' }, { status: 400 });
  let body: any = null;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }
  const id = String(body?.id || '').trim();
  if (!id) return NextResponse.json({ ok: false, error: 'ID requerido' }, { status: 400 });
  try {
    const { data: option } = await supabaseAdmin
      .from('options')
      .select('group_id')
      .eq('id', id)
      .maybeSingle();
    if (!option) throw new Error('Opción no encontrada');
    await assertGroupBelongsToBusiness((option as any).group_id, bid);
    const payload = sanitizeOptionPayload(body);
    const { error } = await supabaseAdmin
      .from('options')
      .update(payload)
      .eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'No se pudo actualizar' }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const auth = await assertAdminOrMember();
  if (!auth.ok) return auth.res;
  const slug = await getTenantSlug();
  const bid = await getBusinessIdBySlug(slug);
  if (!bid) return NextResponse.json({ ok: false, error: 'Negocio no encontrado' }, { status: 400 });
  const url = new URL(req.url);
  const id = url.searchParams.get('id') || '';
  if (!id) return NextResponse.json({ ok: false, error: 'ID requerido' }, { status: 400 });
  try {
    const { data: option } = await supabaseAdmin
      .from('options')
      .select('group_id')
      .eq('id', id)
      .maybeSingle();
    if (!option) throw new Error('Opción no encontrada');
    await assertGroupBelongsToBusiness((option as any).group_id, bid);
    const { error } = await supabaseAdmin
      .from('options')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'No se pudo eliminar' }, { status: 400 });
  }
}
