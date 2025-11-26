import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { adminEmails } from '@/utils/plan';

type PromotionScope = 'order' | 'category' | 'product';
type PromotionType = 'percent' | 'fixed';

// Helpers para identificar al negocio y validar permisos.
async function getTenantSlug(): Promise<string> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get('x-tenant-slug')?.value || '';
  } catch {
    return '';
  }
}

async function assertAdminOrMember(): Promise<{ ok: true; userId: string | null } | { ok: false; res: Response }> {
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
      return { ok: false, res: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) };
    }
    return { ok: true, userId };
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

function sanitizeWeekdays(value: any): number[] {
  if (!Array.isArray(value)) return [1, 2, 3, 4, 5, 6, 7];
  const normalized = Array.from(
    new Set(
      value
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
    )
  ).sort((a, b) => a - b);
  return normalized.length > 0 ? normalized : [1, 2, 3, 4, 5, 6, 7];
}

function sanitizeDate(value: any): string | null {
  if (!value) return null;
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function sanitizePayload(body: any) {
  const type = (String(body?.type || '') as PromotionType).toLowerCase();
  if (!['percent', 'fixed'].includes(type)) {
    throw new Error('Tipo de promocion invalido');
  }
  const scope = (String(body?.scope || '') as PromotionScope).toLowerCase();
  if (!['order', 'category', 'product'].includes(scope)) {
    throw new Error('Ambito invalido');
  }
  const name = String(body?.name || '').trim();
  if (!name) throw new Error('Nombre requerido');
  const description = typeof body?.description === 'string' ? body.description.trim() : null;
  const value = Number(body?.value);
  if (!Number.isFinite(value) || value < 0) throw new Error('Importe/porcentaje invalido');
  if (type === 'percent' && (value <= 0 || value > 100)) throw new Error('Porcentaje debe estar entre 0 y 100');
  if (type === 'fixed' && value <= 0) throw new Error('El descuento fijo debe ser mayor a 0');
  const minAmount = body?.min_amount == null ? 0 : Number(body?.min_amount);
  if (!Number.isFinite(minAmount) || minAmount < 0) throw new Error('Importe minimo invalido');
  const targetCategoryId = body?.target_category_id == null ? null : Number(body?.target_category_id);
  const productIdsRaw: number[] = Array.isArray(body?.target_product_ids)
    ? body.target_product_ids.map((id: any) => Number(id)).filter((n: number) => Number.isFinite(n))
    : [];
  const targetProductId = body?.target_product_id == null ? null : Number(body?.target_product_id);
  if (scope === 'category' && !targetCategoryId) throw new Error('Selecciona una categoria para la promocion');
  if (scope === 'product' && productIdsRaw.length === 0 && !targetProductId) throw new Error('Selecciona al menos un producto para la promocion');
  const weekdays = sanitizeWeekdays(body?.weekdays);
  const startDate = sanitizeDate(body?.start_date);
  const endDate = sanitizeDate(body?.end_date);
  const active = body?.active === false ? false : true;
  const normalizedProductIds =
    scope === 'product'
      ? (productIdsRaw.length > 0 ? productIdsRaw : (targetProductId ? [targetProductId] : []))
      : [];
  return {
    name,
    description,
    type,
    value,
    scope,
    target_category_id: scope === 'category' ? targetCategoryId : null,
    target_product_id: scope === 'product' ? (normalizedProductIds[0] ?? null) : null,
    target_product_ids: scope === 'product' ? (normalizedProductIds.length > 0 ? normalizedProductIds : null) : null,
    min_amount: minAmount,
    start_date: startDate,
    end_date: endDate,
    weekdays,
    active,
  };
}

// Lista promociones + categorías y productos para que el panel pueda referenciarlos.
export async function GET() {
  const auth = await assertAdminOrMember();
  if (!auth.ok) return auth.res;
  const slug = await getTenantSlug();
  const bid = await getBusinessIdBySlug(slug);
  if (!bid) return NextResponse.json({ ok: true, promotions: [], categories: [], products: [] });

  const { data: promotions, error } = await supabaseAdmin
    .from('promotions')
    .select('*')
    .eq('business_id', bid)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  const { data: categories } = await supabaseAdmin
    .from('categories')
    .select('id, name')
    .eq('business_id', bid)
    .order('name', { ascending: true });

  const { data: products } = await supabaseAdmin
    .from('products')
    .select('id, name, active')
    .eq('business_id', bid)
    .order('name', { ascending: true });

  return NextResponse.json({
    ok: true,
    promotions: promotions || [],
    categories: categories || [],
    products: products || [],
  });
}

// Crea una promoción nueva.
export async function POST(req: Request) {
  const auth = await assertAdminOrMember();
  if (!auth.ok) return auth.res;
  const slug = await getTenantSlug();
  const bid = await getBusinessIdBySlug(slug);
  if (!bid) return NextResponse.json({ ok: false, error: 'Negocio no encontrado' }, { status: 400 });
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON invalido' }, { status: 400 });
  }
  try {
    const payload = sanitizePayload(body);
    const { data, error } = await supabaseAdmin
      .from('promotions')
      .insert({ ...payload, business_id: bid })
      .select('id')
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, id: (data as any)?.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'No se pudo crear la promocion' }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const auth = await assertAdminOrMember();
  if (!auth.ok) return auth.res;
  const slug = await getTenantSlug();
  const bid = await getBusinessIdBySlug(slug);
  if (!bid) return NextResponse.json({ ok: false, error: 'Negocio no encontrado' }, { status: 400 });
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON invalido' }, { status: 400 });
  }
  const id = String(body?.id || '').trim();
  if (!id) return NextResponse.json({ ok: false, error: 'ID requerido' }, { status: 400 });
  try {
    const payload = sanitizePayload(body);
    const { error } = await supabaseAdmin
      .from('promotions')
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
    .from('promotions')
    .delete()
    .eq('id', id)
    .eq('business_id', bid);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
