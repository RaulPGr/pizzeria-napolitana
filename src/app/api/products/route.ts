// src/app/api/products/route.ts
import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { adminEmails } from '@/utils/plan';


export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TABLE = process.env.NEXT_PUBLIC_PRODUCTS_TABLE || 'products';
// Bucket para imágenes (crea uno público en Supabase Storage con este nombre)
const BUCKET = process.env.NEXT_PUBLIC_STORAGE_BUCKET || 'product-images';

function sanitizeFileName(name: string) {
  try {
    // Elimina acentos y caracteres fuera de ASCII seguro para claves de Storage
    const noAccents = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // Sustituye espacios y caracteres no válidos por '-'
    const safe = noAccents.replace(/[^a-zA-Z0-9._-]+/g, '-');
    // Evita encabezados o dobles puntos raros
    return safe.replace(/^-+/, '').replace(/-+$/, '').slice(0, 180) || 'file';
  } catch {
    return 'file';
  }
}

function normalizeSlug(v: string | null | undefined): string {
  const s = (v || '').trim().toLowerCase();
  return s && /^[a-z0-9-_.]{1,120}$/.test(s) ? s : '';
}

async function supabaseFromRequest(req?: Request) {
  const cookieStore = await cookies();
  const hdrs = await headers();
  let tenant = normalizeSlug(cookieStore.get('x-tenant-slug')?.value);
  if (!tenant) {
    // Fallback: derivar slug del subdominio del Host (negocio.dominio.tld)
    const host = (hdrs.get('host') || '').split(':')[0];
    const parts = host.split('.');
    if (parts.length >= 3) {
      const first = normalizeSlug(parts[0]);
      tenant = first && first !== 'www' && first !== 'm' ? first : normalizeSlug(parts[1]);
    }
  }
  if (!tenant && req) {
    try {
      const url = new URL(req.url);
      tenant = normalizeSlug(url.searchParams.get('tenant')) || tenant;
    } catch {}
  }
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: tenant ? { 'x-tenant-slug': tenant } : {} },
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: any) { try { cookieStore.set({ name, value, ...options }); } catch {} },
        remove(name: string, options: any) { try { cookieStore.set({ name, value: '', ...options, maxAge: 0 }); } catch {} },
      },
    }
  );
}

async function getTenantSlug(req?: Request): Promise<string> {
  try {
    const cookieStore = await cookies();
    const inCookie = normalizeSlug(cookieStore.get('x-tenant-slug')?.value);
    if (inCookie) return inCookie;
    const hdrs = await headers();
    const host = (hdrs.get('host') || '').split(':')[0];
    const parts = host.split('.')
    if (parts.length >= 3) {
      const first = normalizeSlug(parts[0]);
      return first && first !== 'www' && first !== 'm' ? first : normalizeSlug(parts[1]);
    }
    if (req) {
      try { const u = new URL(req.url); const qp = normalizeSlug(u.searchParams.get('tenant')); if (qp) return qp; } catch {}
    }
    return '';
  } catch {
    return '';
  }
}

async function getBusinessIdBySlug(slug: string): Promise<string | null> {
  if (!slug) return null;
  try {
    const { data, error } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (error) return null;
    return (data as any)?.id ?? null;
  } catch {
    return null;
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
          get(name: string) { return cookieStore.get(name)?.value; },
          set(name: string, value: string, options: any) {
            try { cookieStore.set({ name, value, ...options }); } catch {}
          },
          remove(name: string, options: any) {
            try { cookieStore.set({ name, value: '', ...options, maxAge: 0 }); } catch {}
          },
        },
      }
    );
    const { data } = await supa.auth.getUser();
    const email = data.user?.email?.toLowerCase() || '';
    const uid = data.user?.id || '';
    const admins = adminEmails();
    let allowed = admins.length === 0 ? !!email : admins.includes(email);
    if (!allowed) {
      // Si no es superadmin, permitir si es miembro del negocio del subdominio
      try {
        const slug = await getTenantSlug();
        const bid = await getBusinessIdBySlug(slug);
        if (bid && uid) {
          const { data: mm } = await supabaseAdmin
            .from('business_members')
            .select('user_id')
            .eq('business_id', bid)
            .eq('user_id', uid)
            .maybeSingle();
          allowed = !!mm;
        }
      } catch {}
    }
    if (!allowed) return { ok: false, res: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) };
    return { ok: true };
  } catch {
    return { ok: false, res: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) };
  }
}

// ---------- GET: productos + categorías ----------
export async function GET(req: Request) {
  const supabase = await supabaseFromRequest(req);

  // Detect business menu_mode via admin (RLS on businesses is member-only)
  let menu_mode: 'fixed' | 'daily' = 'fixed';
  try {
    const slug = await getTenantSlug(req);
    if (slug) {
      const { data: biz, error: berr } = await supabaseAdmin
        .from('businesses')
        .select('menu_mode')
        .eq('slug', slug)
        .maybeSingle();
      if (!berr && biz?.menu_mode) menu_mode = (biz.menu_mode as any) === 'daily' ? 'daily' : 'fixed';
    }
  } catch {}

  // Selected day (1..7 ISO) if daily; default today
  let selectedDay: number | null = null;
  if (menu_mode === 'daily') {
    const now = new Date();
    const jsDay = now.getDay(); // 0..6 (Sun..Sat)
    selectedDay = ((jsDay + 6) % 7) + 1; // 1..7 Mon..Sun
    try {
      const url = new URL(req.url);
      const qd = Number(url.searchParams.get('day'));
      if (qd >= 1 && qd <= 7) selectedDay = qd;
    } catch {}
  }

  let products: any[] | null = null;
  let error: any = null;
  // Siempre devolvemos todos los productos activos; si el modo es 'daily', adjuntamos los días
  const { data, error: err } = await supabase
    .from(TABLE)
    .select('*, product_weekdays(day)')
    .eq('active', true as any)
    .order('category_id', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  products = data as any[] | null;
  error = err;
  // Fallback para casos donde RLS devuelva 0 productos en ciertos navegadores/dispositivos
  if (!error && Array.isArray(products) && products.length === 0) {
    try {
      const slugF = await getTenantSlug(req);
      const bidF = await getBusinessIdBySlug(slugF);
      if (bidF) {
        const { data: p2, error: e2 } = await supabaseAdmin
          .from(TABLE)
          .select('*, product_weekdays(day)')
          .eq('active', true as any)
          .eq('business_id', bidF)
          .order('category_id', { ascending: true })
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true });
        if (!e2 && Array.isArray(p2)) {
          products = p2 as any[];
        }
      }
    } catch {}
  }
  // If menu is daily and a selectedDay is present, filter in-memory to that day
  if (menu_mode === 'daily' && Array.isArray(products) && selectedDay && selectedDay >= 1 && selectedDay <= 7) {
    products = products.filter((p: any) => {
      const days = Array.isArray(p?.product_weekdays)
        ? p.product_weekdays.map((x: any) => Number(x?.day)).filter((n: any) => n >= 1 && n <= 7)
        : [];
      return days.length === 7 || days.includes(selectedDay!);
    });
  }
  // Salvaguarda adicional: filtrar por negocio en memoria si hay bid
  try {
    const slugZ = await getTenantSlug(req);
    const bidZ = await getBusinessIdBySlug(slugZ);
    if (bidZ && Array.isArray(products)) {
      products = products.filter((p: any) => String(p?.business_id || '') === String(bidZ));
    }
  } catch {}

  let categories: any[] | null = null; let catErr: any = null;
  try {
    const slugX = await getTenantSlug(req);
    const bidX = await getBusinessIdBySlug(slugX);
    let q = supabase.from('categories').select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    const { data: cats, error } = bidX ? await q.eq('business_id', bidX) : await q;
    categories = cats as any[] | null;
    catErr = error;
  } catch (e) { catErr = e; }

  if (error || catErr) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? catErr?.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, products, categories, menu_mode });
}

// ---------- POST: crear ----------
export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') || '';
  const auth = await assertAdminOrMember();
  if (!auth.ok) return auth.res;

  // Creamos el producto (JSON). Si luego quieres subir imagen, usa PATCH multipart con id.
  if (contentType.includes('application/json')) {
    const body = await req.json();
    const slug = await getTenantSlug();
    const bid = await getBusinessIdBySlug(slug);
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .insert({
        name: body.name,
        description: body.description ?? null,
        price: body.price ?? 0,
        image_url: body.image_url ?? null,
        available: !!body.available,
        category_id: body.category_id ?? null,
        business_id: bid ?? null,
      })
      .select('id')
      .single();

    if (error) return NextResponse.json({ ok: false, error: error?.message || 'Error' }, { status: 400 });
    try {
      if (data?.id && Array.isArray(body.weekdays)) {
        const pid = Number(data.id);
        const days = (body.weekdays as any[])
          .map((d) => Number(d))
          .filter((d) => d >= 1 && d <= 7);
        if (days.length > 0) {
          const rows = days.map((d) => ({ product_id: pid, day: d }));
          await supabaseAdmin.from('product_weekdays').upsert(rows, { onConflict: 'product_id,day' } as any);
        }
      }
    } catch {}

    return NextResponse.json({ ok: true, id: data?.id });
  }

  return NextResponse.json({ ok: false, error: 'Unsupported content type' }, { status: 415 });
}

// ---------- PATCH: actualizar o subir imagen ----------
export async function PATCH(req: Request) {
  const contentType = req.headers.get('content-type') || '';
  const auth = await assertAdminOrMember();
  if (!auth.ok) return auth.res;

  // Subida de imagen (multipart/form-data)
  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const id = Number(form.get('id'));
      const file = form.get('file');
      if (id && file && file instanceof File) {
        const safeName = sanitizeFileName(file.name || 'upload');
        const filePath = `${id}/${Date.now()}_${safeName}`;
        const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).upload(filePath, file, { upsert: true });
        if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 });
        const pub = supabaseAdmin.storage.from(BUCKET).getPublicUrl(filePath);
        const { error: updErr } = await supabaseAdmin.from(TABLE).update({ image_url: pub.data.publicUrl }).eq('id', id);
        if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 });
        return NextResponse.json({ ok: true, url: pub.data.publicUrl });
      }
    }
  } catch {}

  // Actualización JSON normal
  const body = await req.json();
  if (!body.id) {
    return NextResponse.json({ ok: false, error: 'id requerido' }, { status: 400 });
  }

  const updates: any = {};
  for (const key of ['name', 'description', 'price', 'image_url', 'available', 'category_id']) {
    if (key in body) updates[key] = body[key];
  }
  if ('price' in updates) {
    const raw = String(updates.price ?? 0).replace(',', '.');
    const parsed = parseFloat(raw);
    updates.price = isNaN(parsed) ? 0 : parsed;
  }
  if ('description' in updates) {
    if (updates.description === null || updates.description === undefined || updates.description === '') {
      updates.description = null;
    } else {
      try {
        updates.description = String(updates.description).trim().slice(0, 1000);
      } catch { updates.description = null; }
    }
  }
  if ('image_url' in updates && updates.image_url) {
    try { updates.image_url = String(updates.image_url).trim().slice(0, 1000); } catch {}
  }

  // Limita la actualización al negocio actual
  {
    const slug = await getTenantSlug();
    const bid = await getBusinessIdBySlug(slug);
    let qUpd = supabaseAdmin.from(TABLE).update(updates).eq('id', body.id);
    const { error } = bid ? await qUpd.eq('business_id', bid) : await qUpd;
    if (error) return NextResponse.json({ ok: false, error: error?.message || 'Error' }, { status: 400 });
  }

  // Update weekdays (replace) if provided
  try {
    if (Array.isArray(body.weekdays)) {
      const pid = Number(body.id);
      await supabaseAdmin.from('product_weekdays').delete().eq('product_id', pid);
      const days = (body.weekdays as any[])
        .map((d) => Number(d))
        .filter((d) => d >= 1 && d <= 7);
      if (days.length > 0) {
        const rows = days.map((d) => ({ product_id: pid, day: d }));
        await supabaseAdmin.from('product_weekdays').upsert(rows, { onConflict: 'product_id,day' } as any);
      }
    }
  } catch {}

  return NextResponse.json({ ok: true });
}

// ---------- DELETE: borrar ?id= ----------
export async function DELETE(req: Request) {
  const auth = await assertAdminOrMember();
  if (!auth.ok) return auth.res;
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get('id'));
  if (!id) return NextResponse.json({ ok: false, error: 'id requerido' }, { status: 400 });

  const slug = await getTenantSlug();
  const bid = await getBusinessIdBySlug(slug);
  let qDel = supabaseAdmin.from(TABLE).delete().eq('id', id);
  const { error } = bid ? await qDel.eq('business_id', bid) : await qDel;
  // si llega aquí, ya no hay error

  return NextResponse.json({ ok: true });
}


