// src/app/api/products/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
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

async function supabaseFromCookies() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {}
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options, maxAge: 0 });
          } catch {}
        },
      },
    }
  );
}

async function assertAdmin(): Promise<{ ok: true } | { ok: false; res: Response }> {
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
    const admins = adminEmails();
    const allowed = admins.length === 0 ? !!email : admins.includes(email);
    if (!allowed) {
      return { ok: false, res: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) };
    }
    return { ok: true };
  } catch {
    return { ok: false, res: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) };
  }
}

// ---------- GET: productos + categorías ----------
export async function GET() {
  const supabase = await supabaseFromCookies();

  const { data: products, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('category_id', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  const { data: categories, error: catErr } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error || catErr) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? catErr?.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, products, categories });
}

// ---------- POST: crear ----------
export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') || '';
  const auth = await assertAdmin();
  if (!auth.ok) return auth.res;

  // Creamos el producto (JSON). Si luego quieres subir imagen, usa PATCH multipart con id.
  if (contentType.includes('application/json')) {
    const body = await req.json();
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .insert({
        name: body.name,
        description: body.description ?? null,
        price: body.price ?? 0,
        image_url: body.image_url ?? null,
        available: !!body.available,
        category_id: body.category_id ?? null,
      })
      .select('id')
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, id: data?.id });
  }

  return NextResponse.json({ ok: false, error: 'Unsupported content type' }, { status: 415 });
}

// ---------- PATCH: actualizar o subir imagen ----------
export async function PATCH(req: Request) {
  const contentType = req.headers.get('content-type') || '';
  const auth = await assertAdmin();
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

  const { error } = await supabaseAdmin.from(TABLE).update(updates).eq('id', body.id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

// ---------- DELETE: borrar ?id= ----------
export async function DELETE(req: Request) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.res;
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get('id'));
  if (!id) return NextResponse.json({ ok: false, error: 'id requerido' }, { status: 400 });

  const { error } = await supabaseAdmin.from(TABLE).delete().eq('id', id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
