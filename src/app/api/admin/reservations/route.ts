// src/app/api/admin/reservations/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendReservationStatusEmail } from '@/lib/email/sendReservationEmails';

function normalizeSlug(v: string | null | undefined): string {
  const s = (v || '').trim().toLowerCase();
  return s && /^[a-z0-9-_.]{1,120}$/.test(s) ? s : '';
}

async function getTenantSlug(req?: Request) {
  let slug = '';
  if (req) {
    try {
      const u = new URL(req.url);
      slug = normalizeSlug(u.searchParams.get('tenant'));
    } catch {}
  }
  if (!slug) {
    try {
      const cookieStore = await cookies();
      slug = normalizeSlug(cookieStore.get('x-tenant-slug')?.value);
    } catch {}
  }
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

function formatReservationTimestamp(value: string, tzOffsetMinutes?: number | null) {
  try {
    const d = new Date(value);
    if (typeof tzOffsetMinutes === 'number' && Number.isFinite(tzOffsetMinutes)) {
      d.setMinutes(d.getMinutes() - tzOffsetMinutes);
    }
    return d.toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' });
  } catch {
    return value;
  }
}

// Lista las reservas del negocio actual (panel admin).
export async function GET(req: Request) {
  try {
    const slug = await getTenantSlug(req);
    if (!slug) return NextResponse.json({ ok: false, error: 'Missing tenant' }, { status: 400 });

    const { data: biz, error: bizErr } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (bizErr) return NextResponse.json({ ok: false, error: bizErr.message }, { status: 400 });
    if (!biz) return NextResponse.json({ ok: false, error: 'Business not found' }, { status: 404 });

    const { data, error } = await supabaseAdmin
      .from('reservations')
      .select('id, customer_name, customer_email, customer_phone, party_size, reserved_at, notes, status, created_at, timezone_offset_minutes')
      .eq('business_id', (biz as any)?.id)
      .order('reserved_at', { ascending: true });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, reservations: data || [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Error' }, { status: 500 });
  }
}

// Permite cambiar estado de la reserva y envía email si procede.
export async function PATCH(req: Request) {
  try {
    const slug = await getTenantSlug(req);
    if (!slug) return NextResponse.json({ ok: false, error: 'Missing tenant' }, { status: 400 });
    const { data: biz, error: bizErr } = await supabaseAdmin
      .from('businesses')
      .select('id, name, address_line, city, postal_code, logo_url')
      .eq('slug', slug)
      .maybeSingle();
    if (bizErr) return NextResponse.json({ ok: false, error: bizErr.message }, { status: 400 });
    if (!biz) return NextResponse.json({ ok: false, error: 'Business not found' }, { status: 404 });

    let body: any = {};
    try { body = await req.json(); } catch {}
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    const status = typeof body?.status === 'string' ? body.status.trim().toLowerCase() : '';
    if (!id || !['pending', 'confirmed', 'cancelled'].includes(status)) {
      return NextResponse.json({ ok: false, error: 'Datos inválidos' }, { status: 400 });
    }

    const { data: reservation, error: resErr } = await supabaseAdmin
      .from('reservations')
      .select('id, customer_name, customer_email, customer_phone, party_size, reserved_at, notes, status, timezone_offset_minutes')
      .eq('business_id', (biz as any)?.id)
      .eq('id', id)
      .maybeSingle();
    if (resErr) return NextResponse.json({ ok: false, error: resErr.message }, { status: 400 });
    if (!reservation) return NextResponse.json({ ok: false, error: 'Reserva no encontrada' }, { status: 404 });

    if (reservation.status === status) {
      return NextResponse.json({ ok: true, reservation });
    }

    const { error: updateErr } = await supabaseAdmin
      .from('reservations')
      .update({ status })
      .eq('id', id)
      .eq('business_id', (biz as any)?.id);
    if (updateErr) return NextResponse.json({ ok: false, error: updateErr.message }, { status: 400 });

    if (reservation.customer_email && (status === 'confirmed' || status === 'cancelled')) {
      const address = [ (biz as any)?.address_line, (biz as any)?.postal_code, (biz as any)?.city ].filter(Boolean).join(', ') || undefined;
      await sendReservationStatusEmail({
        businessName: (biz as any)?.name || 'PideLocal',
        businessAddress: address,
        businessLogoUrl: (biz as any)?.logo_url || undefined,
        customerName: reservation.customer_name,
        customerEmail: reservation.customer_email,
        partySize: reservation.party_size,
        reservedFor: formatReservationTimestamp(reservation.reserved_at, reservation.timezone_offset_minutes ?? null),
        notes: reservation.notes,
        status: status as 'confirmed' | 'cancelled',
        customerPhone: reservation.customer_phone,
      });
    }

    return NextResponse.json({ ok: true, reservation: { ...reservation, status } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Error' }, { status: 500 });
  }
}
