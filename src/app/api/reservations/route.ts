// src/app/api/reservations/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getTenant } from '@/lib/tenant';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendReservationBusinessEmail, sendReservationCustomerEmail } from '@/lib/email/sendReservationEmails';

type OpeningTramo = { abre?: string; cierra?: string; open?: string; close?: string };
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

function parseTramos(list: any): Array<{ start: number; end: number }> {
  if (!Array.isArray(list)) return [];
  const tramos: Array<{ start: number; end: number }> = [];
  for (const item of list as OpeningTramo[]) {
    const start = (item.abre ?? item.open ?? '').split(':');
    const end = (item.cierra ?? item.close ?? '').split(':');
    if (start.length === 2 && end.length === 2) {
      const startMinutes = Number(start[0]) * 60 + Number(start[1]);
      const endMinutes = Number(end[0]) * 60 + Number(end[1]);
      if (!Number.isNaN(startMinutes) && !Number.isNaN(endMinutes) && endMinutes > startMinutes) {
        tramos.push({ start: startMinutes, end: endMinutes });
      }
    }
  }
  return tramos;
}

function isWithinSchedule(dateISO: string, timeHHMM: string, openingHours: any): boolean {
  if (!openingHours) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO) || !/^\d{2}:\d{2}$/.test(timeHHMM)) return false;
  const [y, m, d] = dateISO.split('-').map(Number);
  const [hh, mm] = timeHHMM.split(':').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
  const dayKey = DAY_KEYS[dt.getDay()];
  const tramos = parseTramos(openingHours?.[dayKey]);
  if (tramos.length === 0) return false;
  const minutes = hh * 60 + mm;
  return tramos.some((t) => minutes >= t.start && minutes < t.end);
}

function formatReservationTimestamp(date: Date, tzOffsetMinutes?: number | null): string {
  try {
    const displayDate = new Date(date);
    if (typeof tzOffsetMinutes === 'number' && Number.isFinite(tzOffsetMinutes)) {
      displayDate.setMinutes(displayDate.getMinutes() - tzOffsetMinutes);
    }
    return displayDate.toLocaleString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return date.toISOString();
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenant = await getTenant();
    if (!tenant?.id) {
      return NextResponse.json({ ok: false, message: 'Negocio no encontrado' }, { status: 400 });
    }
    const social = (tenant as any)?.social || {};
    if (!social?.reservations_enabled) {
      return NextResponse.json({ ok: false, message: 'Las reservas no estan activadas' }, { status: 400 });
    }
    const capacity = Number(social?.reservations_capacity ?? 0);

    const name = (body?.name || '').trim();
    const phone = (body?.phone || '').trim();
    const email = (body?.email || '').trim();
    const people = Number(body?.people || 0);
    const date = String(body?.date || '').trim();
    const time = String(body?.time || '').trim();
    const notes = (body?.notes || '').trim() || null;
    const tzOffsetRaw = Number(body?.tzOffsetMinutes);
    const tzOffsetMinutes =
      Number.isFinite(tzOffsetRaw) && Math.abs(tzOffsetRaw) <= 14 * 60 ? Math.trunc(tzOffsetRaw) : null;

    if (!name || !phone || !date || !time || Number.isNaN(people) || people <= 0) {
      return NextResponse.json({ ok: false, message: 'Faltan datos de la reserva' }, { status: 400 });
    }

    const [yyyy, mm, dd] = date.split('-').map((part) => Number(part));
    const [hh, min] = time.split(':').map((part) => Number(part));
    if (
      !Number.isInteger(yyyy) ||
      !Number.isInteger(mm) ||
      !Number.isInteger(dd) ||
      !Number.isInteger(hh) ||
      !Number.isInteger(min)
    ) {
      return NextResponse.json({ ok: false, message: 'Fecha u hora invalida' }, { status: 400 });
    }
    const utcMillis = Date.UTC(yyyy, (mm || 1) - 1, dd || 1, hh || 0, min || 0);
    const offsetToUse = typeof tzOffsetMinutes === 'number' ? tzOffsetMinutes : 0;
    const reservedAt = new Date(utcMillis + offsetToUse * 60_000);
    if (reservedAt.getTime() < Date.now()) {
      return NextResponse.json({ ok: false, message: 'No puedes reservar en el pasado' }, { status: 400 });
    }
    if (!isWithinSchedule(date, time, tenant.opening_hours)) {
      return NextResponse.json({ ok: false, message: 'La reserva debe estar dentro del horario de apertura' }, { status: 400 });
    }

    if (capacity && capacity > 0) {
      const { count, error: countErr } = await supabaseAdmin
        .from('reservations')
        .select('*', { head: true, count: 'exact' })
        .eq('business_id', tenant.id)
        .eq('reserved_at', reservedAt.toISOString())
        .neq('status', 'cancelled');
      if (countErr) throw countErr;
      if ((count ?? 0) >= capacity) {
        return NextResponse.json({ ok: false, message: 'La franja horaria ya no tiene disponibilidad. Elige otra hora.' }, { status: 409 });
      }
    }

    const { data: inserted, error } = await supabaseAdmin
      .from('reservations')
      .insert({
        business_id: tenant.id,
        customer_name: name,
        customer_email: email || null,
        customer_phone: phone,
        party_size: people,
        reserved_at: reservedAt.toISOString(),
        notes,
        timezone_offset_minutes: tzOffsetMinutes,
      })
      .select('id')
      .maybeSingle();
    if (error) throw error;

    const reservedFor = formatReservationTimestamp(reservedAt, tzOffsetMinutes);
    const businessEmail = social?.reservations_email || (tenant as any)?.email || null;
    const businessAddress = [tenant.address_line, tenant.postal_code, tenant.city].filter(Boolean).join(', ') || undefined;

    if (email) {
      await sendReservationCustomerEmail({
        businessName: tenant.name || 'PideLocal',
        businessAddress,
        businessLogoUrl: tenant.logo_url || undefined,
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        partySize: people,
        reservedFor,
        notes,
      });
    }

    if (businessEmail) {
      await sendReservationBusinessEmail({
        businessName: tenant.name || 'PideLocal',
        businessAddress,
        businessLogoUrl: tenant.logo_url || undefined,
        businessTargetEmail: businessEmail,
        customerName: name,
        customerPhone: phone,
        customerEmail: email || null,
        partySize: people,
        reservedFor,
        notes,
      });
    }

    return NextResponse.json({ ok: true, id: inserted?.id, message: 'Reserva enviada correctamente' });
  } catch (e: any) {
    console.error('[reservations] error', e);
    return NextResponse.json({ ok: false, message: e?.message || 'No se pudo crear la reserva' }, { status: 400 });
  }
}
