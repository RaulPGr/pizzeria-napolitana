import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { adminEmails } from '@/utils/plan';

type SelectionType = 'single' | 'multiple';

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

function sanitizeGroupPayload(body: any) {
  const name = String(body?.name || '').trim();
  if (!name) throw new Error('Nombre requerido');
  const selection = String(body?.selection_type || '').toLowerCase() as SelectionType;
  if (!['single', 'multiple'].includes(selection)) throw new Error('Tipo de selección inválido');
  const min = body?.min_select == null ? 0 : Number(body.min_select);
  const maxRaw = body?.max_select == null || body.max_select === '' ? null : Number(body.max_select);
  const max = maxRaw == null ? null : maxRaw;
  if (!Number.isFinite(min) || min < 0) throw new Error('Min seleccionado inválido');
  if (max != null && (!Number.isFinite(max) || max < min)) throw new Error('Max seleccionado inválido');
  const description = typeof body?.description === 'string' ? body.description.trim() : null;
  const isRequired = body?.is_required === true;
  return {
    name,
    description,
    selection_type: selection,
    min_select: min,
    max_select: max,
    is_required: isRequired,
  };
}

export async function GET() {
  const auth = await assertAdminOrMember();
  if (!auth.ok) return auth.res;
  const slug = await getTenantSlug();
  const bid = await getBusinessIdBySlug(slug);
  if (!bid) return NextResponse.json({ ok: true, groups: [], options: {} });

  const { data: groups, error } = await supabaseAdmin
    .from('option_groups')
    .select('id, name, description, selection_type, min_select, max_select, is_required, created_at')
    .eq('business_id', bid)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  const groupIds = (groups || []).map((g) => g.id);
  let optionsMap: Record<string, any[]> = {};
  if (groupIds.length > 0) {
    const { data: options } = await supabaseAdmin
      .from('options')
      .select('id, group_id, name, price_delta, sort_order, created_at')
      .in('group_id', groupIds)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    optionsMap = (options || []).reduce<Record<string, any[]>>((acc, opt) => {
      const key = (opt as any).group_id as string;
      if (!acc[key]) acc[key] = [];
      acc[key].push(opt);
      return acc;
    }, {});
  }

  const groupsWithCounts = (groups || []).map((g) => ({
    ...g,
    options_count: optionsMap[g.id]?.length || 0,
  }));

  return NextResponse.json({ ok: true, groups: groupsWithCounts, options: optionsMap });
}

export async function POST(req: Request) {
  const auth = await assertAdminOrMember();
  if (!auth.ok) return auth.res;
  const slug = await getTenantSlug();
  const bid = await getBusinessIdBySlug(slug);
  if (!bid) return NextResponse.json({ ok: false, error: 'Negocio no encontrado' }, { status: 400 });
  let body: any = null;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }
  try {
    const payload = sanitizeGroupPayload(body);
    const { data, error } = await supabaseAdmin
      .from('option_groups')
      .insert({ ...payload, business_id: bid })
      .select('id')
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, id: (data as any)?.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'No se pudo crear el grupo' }, { status: 400 });
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
    const payload = sanitizeGroupPayload(body);
    const { error } = await supabaseAdmin
      .from('option_groups')
      .update(payload)
      .eq('id', id)
      .eq('business_id', bid);
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
  const { error } = await supabaseAdmin
    .from('option_groups')
    .delete()
    .eq('id', id)
    .eq('business_id', bid);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
