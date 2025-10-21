// src/app/api/admin/business/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

function sanitizeFileName(name: string) {
  try {
    const noAccents = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const safe = noAccents.replace(/[^a-zA-Z0-9._-]+/g, '-');
    return safe.replace(/^-+/, '').replace(/-+$/, '').slice(0, 180) || 'file';
  } catch {
    return 'file';
  }
}

async function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, service, { auth: { persistSession: false } });
}

async function getBusinessBySlug(slug: string) {
  const supa = await getAdminClient();
  const { data, error } = await supa
    .from('businesses')
    .select('id, slug, name, slogan, logo_url, hero_url, phone, whatsapp, email, address_line, opening_hours, social')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get('x-tenant-slug')?.value || '';
    if (!slug) return NextResponse.json({ ok: false, error: 'Missing tenant' }, { status: 400 });
    const biz = await getBusinessBySlug(slug);
    if (!biz) return NextResponse.json({ ok: false, error: 'Business not found' }, { status: 404 });
    return NextResponse.json({ ok: true, data: biz });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get('x-tenant-slug')?.value || '';
    if (!slug) return NextResponse.json({ ok: false, error: 'Missing tenant' }, { status: 400 });
    const biz = await getBusinessBySlug(slug);
    if (!biz) return NextResponse.json({ ok: false, error: 'Business not found' }, { status: 404 });

    const body = await req.json();
    const updates: any = {};
    for (const k of ['name','slogan','logo_url','hero_url','phone','whatsapp','email','address_line']) {
      if (k in body) updates[k] = body[k] === '' ? null : body[k];
    }
    if ('social' in body) {
      updates.social = body.social && typeof body.social === 'object' ? body.social : null;
    }
    if ('opening_hours' in body) {
      // opening_hours se espera como objeto JSON; si llega string, intenta parsear
      try {
        updates.opening_hours = typeof body.opening_hours === 'string'
          ? JSON.parse(body.opening_hours)
          : body.opening_hours;
      } catch {
        return NextResponse.json({ ok: false, error: 'opening_hours inválido' }, { status: 400 });
      }
    }
    if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true });

    const supa = await getAdminClient();
    const { error } = await supa.from('businesses').update(updates).eq('id', biz.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Error' }, { status: 500 });
  }
}

// Upload logo/hero (multipart): fields -> type ('logo'|'hero'), file
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get('x-tenant-slug')?.value || '';
    if (!slug) return NextResponse.json({ ok: false, error: 'Missing tenant' }, { status: 400 });
    const biz = await getBusinessBySlug(slug);
    if (!biz) return NextResponse.json({ ok: false, error: 'Business not found' }, { status: 404 });

    const form = await req.formData();
    const type = String(form.get('type') || '');
    const file = form.get('file');
    if (!file || !(file instanceof File)) return NextResponse.json({ ok: false, error: 'file required' }, { status: 400 });
    if (type !== 'logo' && type !== 'hero') return NextResponse.json({ ok: false, error: 'invalid type' }, { status: 400 });

    const bucket = 'public-assets';
    const supa = await getAdminClient();
    const safe = sanitizeFileName(file.name || `${type}.png`);
    const key = `businesses/${biz.id}/${Date.now()}_${safe}`;
    const { error: upErr } = await supa.storage.from(bucket).upload(key, file, { upsert: true });
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 });
    const url = supa.storage.from(bucket).getPublicUrl(key).data.publicUrl;

    const field = type === 'logo' ? 'logo_url' : 'hero_url';
    const { error } = await supa.from('businesses').update({ [field]: url }).eq('id', biz.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, url });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Error' }, { status: 500 });
  }
}
