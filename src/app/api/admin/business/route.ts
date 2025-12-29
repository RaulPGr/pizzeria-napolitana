// src/app/api/admin/business/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
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
    .select('id, slug, name, slogan, description, logo_url, hero_url, phone, whatsapp, email, address_line, city, postal_code, lat, lng, opening_hours, ordering_hours, social, menu_mode, theme_config')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function normalizeSlug(v: string | null | undefined): string {
  const s = (v || '').trim().toLowerCase();
  return s && /^[a-z0-9-_.]{1,120}$/.test(s) ? s : '';
}

async function getTenantSlug(req?: Request) {
  // 1) Permite ?tenant= (útil en previews)
  let slug = '';
  try { if (req) { const u = new URL(req.url); slug = normalizeSlug(u.searchParams.get('tenant')); } } catch {}
  // 2) Cookie puesta por middleware o manualmente
  if (!slug) {
    try { const cookieStore = await cookies(); slug = normalizeSlug(cookieStore.get('x-tenant-slug')?.value); } catch {}
  }
  // 3) Subdominio del host (producción)
  if (!slug) {
    try {
      const hdrs = await headers();
      const host = (hdrs.get('host') || '').split(':')[0];
      const parts = host.split('.');
      if (parts.length >= 3) slug = normalizeSlug(parts[0]);
    } catch {}
  }
  return slug;
}

export async function GET(req: Request) {
  try {
    const slug = await getTenantSlug(req);
    if (!slug) return NextResponse.json({ ok: false, error: 'Missing tenant' }, { status: 400 });
    const biz = await getBusinessBySlug(slug);
    if (!biz) return NextResponse.json({ ok: false, error: 'Business not found' }, { status: 404 });
    const social = (biz as any)?.social || {};
    const ordersEnabled = social?.orders_enabled !== false;
    const reservationsCapacity = Number(social?.reservations_capacity ?? 0);
    const reservationsSlots = Array.isArray(social?.reservations_slots) ? social.reservations_slots : null;
    const reservationsZones = Array.isArray(social?.reservations_zones) ? social.reservations_zones : null;
    const reservationsLeadHours = Number.isFinite(social?.reservations_lead_hours) ? Number(social.reservations_lead_hours) : null;
    const reservationsMaxDays = Number.isFinite(social?.reservations_max_days) ? Number(social.reservations_max_days) : null;
    const reservationsAutoConfirm = typeof social?.reservations_auto_confirm === 'boolean' ? !!social.reservations_auto_confirm : null;
    const reservationsBlockedDates = Array.isArray(social?.reservations_blocked_dates) ? social.reservations_blocked_dates : null;
    const theme = (biz as any)?.theme_config || {};
    const menuLayout = theme?.menu?.layout === 'list' ? 'list' : 'cards';
    const telegramEnabled = !!social?.telegram_notifications_enabled;
    const telegramToken = social?.telegram_bot_token || null;
    const telegramChatId = social?.telegram_chat_id || null;
    const telegramReservationsEnabled = !!social?.telegram_reservations_enabled;
    const telegramReservationsToken = social?.telegram_reservations_bot_token || null;
    const telegramReservationsChatId = social?.telegram_reservations_chat_id || null;
    return NextResponse.json({
      ok: true,
      data: {
        ...biz,
        notify_orders_enabled: !!social.notify_orders_enabled,
        notify_orders_email: social.notify_orders_email || (biz as any)?.email || null,
        orders_enabled: ordersEnabled,
        reservations_enabled: !!social.reservations_enabled,
        reservations_email: social.reservations_email || (biz as any)?.email || null,
        reservations_capacity: Number.isFinite(reservationsCapacity) && reservationsCapacity > 0 ? Math.floor(reservationsCapacity) : 0,
        reservations_slots: reservationsSlots,
        reservations_zones: reservationsZones,
        reservations_lead_hours: reservationsLeadHours,
        reservations_max_days: reservationsMaxDays,
        reservations_auto_confirm: reservationsAutoConfirm,
        reservations_blocked_dates: reservationsBlockedDates,
        menu_layout: menuLayout,
        telegram_notifications_enabled: telegramEnabled,
        telegram_bot_token: telegramToken,
        telegram_chat_id: telegramChatId,
        telegram_reservations_enabled: telegramReservationsEnabled,
        telegram_reservations_bot_token: telegramReservationsToken,
        telegram_reservations_chat_id: telegramReservationsChatId,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const slug = await getTenantSlug(req);
    if (!slug) return NextResponse.json({ ok: false, error: 'Missing tenant' }, { status: 400 });
    const biz = await getBusinessBySlug(slug);
    if (!biz) return NextResponse.json({ ok: false, error: 'Business not found' }, { status: 404 });

    const body = await req.json();
    const updates: any = {};
    for (const k of ['name','slogan','description','logo_url','hero_url','phone','whatsapp','email','address_line','city','postal_code','lat','lng']) {
      if (k in body) updates[k] = body[k] === '' ? null : body[k];
    }
    if ('menu_mode' in body) {
      const mm = String(body.menu_mode || '').toLowerCase();
      if (mm === 'fixed' || mm === 'daily') {
        updates.menu_mode = mm;
      } else if (body.menu_mode === '' || body.menu_mode == null) {
        // allow reset to default
        updates.menu_mode = 'fixed';
      } else {
        return NextResponse.json({ ok: false, error: 'menu_mode inválido' }, { status: 400 });
      }
    }
    let socialUpdates: any | null = null;
    let socialBase = (biz as any)?.social ? { ...(biz as any).social } : {};
    let themeUpdates: any | null = null;
    if (body.social && typeof body.social === 'object') {
      socialBase = { ...socialBase, ...body.social };
      socialUpdates = socialBase;
    }
    if (body.notify_orders_enabled !== undefined) {
      if (!socialUpdates) socialUpdates = { ...socialBase };
      socialUpdates.notify_orders_enabled = !!body.notify_orders_enabled;
    }
    if (body.notify_orders_email !== undefined) {
      if (!socialUpdates) socialUpdates = { ...socialBase };
      const val = typeof body.notify_orders_email === 'string' ? body.notify_orders_email.trim() : null;
      socialUpdates.notify_orders_email = val ? val : null;
    }
    if (body.telegram_notifications_enabled !== undefined) {
      if (!socialUpdates) socialUpdates = { ...socialBase };
      socialUpdates.telegram_notifications_enabled = !!body.telegram_notifications_enabled;
    }
    if (body.telegram_bot_token !== undefined) {
      if (!socialUpdates) socialUpdates = { ...socialBase };
      const val = typeof body.telegram_bot_token === 'string' ? body.telegram_bot_token.trim() : null;
      socialUpdates.telegram_bot_token = val || null;
    }
    if (body.telegram_chat_id !== undefined) {
      if (!socialUpdates) socialUpdates = { ...socialBase };
      const val =
        typeof body.telegram_chat_id === 'string' || typeof body.telegram_chat_id === 'number'
          ? String(body.telegram_chat_id).trim()
          : null;
      socialUpdates.telegram_chat_id = val || null;
    }
    if (body.telegram_reservations_enabled !== undefined) {
      if (!socialUpdates) socialUpdates = { ...socialBase };
      socialUpdates.telegram_reservations_enabled = !!body.telegram_reservations_enabled;
    }
    if (body.telegram_reservations_bot_token !== undefined) {
      if (!socialUpdates) socialUpdates = { ...socialBase };
      const val = typeof body.telegram_reservations_bot_token === 'string'
        ? body.telegram_reservations_bot_token.trim()
        : null;
      socialUpdates.telegram_reservations_bot_token = val || null;
    }
    if (body.telegram_reservations_chat_id !== undefined) {
      if (!socialUpdates) socialUpdates = { ...socialBase };
      const val =
        typeof body.telegram_reservations_chat_id === 'string' || typeof body.telegram_reservations_chat_id === 'number'
          ? String(body.telegram_reservations_chat_id).trim()
          : null;
      socialUpdates.telegram_reservations_chat_id = val || null;
    }
    if (body.orders_enabled !== undefined) {
      if (!socialUpdates) socialUpdates = { ...socialBase };
      socialUpdates.orders_enabled = !!body.orders_enabled;
    }
    if (body.reservations_enabled !== undefined) {
      if (!socialUpdates) socialUpdates = { ...socialBase };
      socialUpdates.reservations_enabled = !!body.reservations_enabled;
    }
    if (body.reservations_email !== undefined) {
      if (!socialUpdates) socialUpdates = { ...socialBase };
      const val = typeof body.reservations_email === 'string' ? body.reservations_email.trim() : null;
      socialUpdates.reservations_email = val ? val : null;
    }
    if (body.reservations_capacity !== undefined) {
      if (!socialUpdates) socialUpdates = { ...socialBase };
      let cap = Number(body.reservations_capacity);
      if (!Number.isFinite(cap) || cap < 0) cap = 0;
      socialUpdates.reservations_capacity = Math.floor(cap);
    }
    if (body.reservations_slots !== undefined) {
      if (!socialUpdates) socialUpdates = { ...socialBase };
      try {
        const raw = Array.isArray(body.reservations_slots) ? body.reservations_slots : JSON.parse(body.reservations_slots);
        if (Array.isArray(raw)) socialUpdates.reservations_slots = raw;
      } catch {}
    }
    if (body.reservations_zones !== undefined) {
      if (!socialUpdates) socialUpdates = { ...socialBase };
      try {
        const raw = Array.isArray(body.reservations_zones) ? body.reservations_zones : JSON.parse(body.reservations_zones);
        if (Array.isArray(raw)) socialUpdates.reservations_zones = raw;
      } catch {}
    }
    if (body.reservations_lead_hours !== undefined) {
      if (!socialUpdates) socialUpdates = { ...socialBase };
      const v = Number(body.reservations_lead_hours);
      socialUpdates.reservations_lead_hours = Number.isFinite(v) && v > 0 ? Math.floor(v) : null;
    }
    if (body.reservations_max_days !== undefined) {
      if (!socialUpdates) socialUpdates = { ...socialBase };
      const v = Number(body.reservations_max_days);
      socialUpdates.reservations_max_days = Number.isFinite(v) && v > 0 ? Math.floor(v) : null;
    }
    if (body.reservations_auto_confirm !== undefined) {
      if (!socialUpdates) socialUpdates = { ...socialBase };
      socialUpdates.reservations_auto_confirm = !!body.reservations_auto_confirm;
    }
    if (body.reservations_blocked_dates !== undefined) {
      if (!socialUpdates) socialUpdates = { ...socialBase };
      try {
        const raw = Array.isArray(body.reservations_blocked_dates)
          ? body.reservations_blocked_dates
          : JSON.parse(body.reservations_blocked_dates);
        if (Array.isArray(raw)) socialUpdates.reservations_blocked_dates = raw;
      } catch {}
    }
    if (body.menu_layout !== undefined) {
      const raw = typeof body.menu_layout === 'string' ? body.menu_layout.trim().toLowerCase() : '';
      let layout: 'cards' | 'list';
      if (raw === 'list') layout = 'list';
      else if (raw === 'cards' || raw === '') layout = 'cards';
      else return NextResponse.json({ ok: false, error: 'menu_layout invalido' }, { status: 400 });
      const currentTheme =
        (biz as any)?.theme_config && typeof (biz as any).theme_config === 'object'
          ? { ...(biz as any).theme_config }
          : {};
      const currentMenu =
        currentTheme.menu && typeof currentTheme.menu === 'object' ? { ...currentTheme.menu } : {};
      const nextTheme = { ...currentTheme, menu: { ...currentMenu, layout } };
      themeUpdates = nextTheme;
    }
    if (socialUpdates) {
      updates.social = socialUpdates;
    }
    if (themeUpdates) {
      updates.theme_config = themeUpdates;
    }
    if ('opening_hours' in body) {
      const raw = body.opening_hours;
      if (raw === '' || raw === null || typeof raw === 'undefined') {
        updates.opening_hours = null;
      } else {
        try {
          updates.opening_hours = typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch {
          return NextResponse.json({ ok: false, error: 'opening_hours inválido' }, { status: 400 });
        }
      }
    }
    if ('ordering_hours' in body) {
      const raw = body.ordering_hours;
      if (raw === '' || raw === null || typeof raw === 'undefined') {
        updates.ordering_hours = null;
      } else {
        try {
          updates.ordering_hours = typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch {
          return NextResponse.json({ ok: false, error: 'ordering_hours inválido' }, { status: 400 });
        }
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
    const slug = await getTenantSlug(req);
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
