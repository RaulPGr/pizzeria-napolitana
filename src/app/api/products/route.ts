// src/app/api/products/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

const TABLE = process.env.NEXT_PUBLIC_PRODUCTS_TABLE || 'products';
// Bucket para imágenes (crea uno público en Supabase Storage con este nombre)
const BUCKET = process.env.NEXT_PUBLIC_STORAGE_BUCKET || 'product-images';

function supabaseFromCookies() {
  const cookieStore = cookies();
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

// ---------- GET: productos + categorías ----------
export async function GET() {
  const supabase = supabaseFromCookies();

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
  const supabase = supabaseFromCookies();

  // Creamos el producto (JSON). Si luego quieres subir imagen, usa PATCH multipart con id.
  if (contentType.includes('application/json')) {
    const body = await req.json();
    const { data, error } = await supabase
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
  const supabase = supabaseFromCookies();
  const contentType = req.headers.get('content-type') || '';

  // Subida de imagen (multipart/form-data): campos -> id, file
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const id = Number(form.get('id'));
    const file = form.get('file') as File | null;

    if (!id || !file || typeof file === 'string') {
      return NextResponse.json({ ok: false, error: 'id y file requeridos' }, { status: 400 });
    }

    const filePath = `${id}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(filePath, file, { upsert: true });

    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 });

    const pub = supabase.storage.from(BUCKET).getPublicUrl(filePath);

    const { error: updErr } = await supabase
      .from(TABLE)
      .update({ image_url: pub.data.publicUrl })
      .eq('id', id);

    if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, url: pub.data.publicUrl });
  }

  // Actualización JSON normal
  const body = await req.json();
  if (!body.id) {
    return NextResponse.json({ ok: false, error: 'id requerido' }, { status: 400 });
  }

  const updates: any = {};
  for (const key of ['name', 'description', 'price', 'image_url', 'available', 'category_id']) {
    if (key in body) updates[key] = body[key];
  }
  if ('price' in updates) updates.price = parseFloat(String(updates.price ?? 0));

  const { error } = await supabase.from(TABLE).update(updates).eq('id', body.id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

// ---------- DELETE: borrar ?id= ----------
export async function DELETE(req: Request) {
  const supabase = supabaseFromCookies();
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get('id'));
  if (!id) return NextResponse.json({ ok: false, error: 'id requerido' }, { status: 400 });

  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
