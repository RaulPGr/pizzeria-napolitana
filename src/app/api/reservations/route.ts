// src/app/api/reservations/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getTenant } from '@/lib/tenant';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendReservationBusinessEmail, sendReservationCustomerEmail } from '@/lib/email/sendReservationEmails';
import { buildReservationTelegramMessage, createTelegramSignature, sendTelegramMessage } from '@/lib/telegram';

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

type Slot = { from: string; to: string; capacity?: number };
function parseSlots(raw: any): Slot[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => ({
      from: typeof s?.from === 'string' ? s.from : '',
      to: typeof s?.to === 'string' ? s.to : '',
      capacity: Number.isFinite(s?.capacity) ? Number(s.capacity) : undefined,
    }))
    .filter((s) => /^\d{2}:\d{2}$/.test(s.from) && /^\d{2}:\d{2}$/.test(s.to));
}

function hhmmToMinutes(v: string) {
  const [h, m] = v.split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = new URL(req.url);
    const slugParam = url.searchParams.get('tenant');
    const tenant = await getTenant(slugParam, { path: url.pathname });
    if (!tenant?.id) {
      return NextResponse.json({ ok: false, message: 'Negocio no encontrado' }, { status: 400 });
    }
    const social = (tenant as any)?.social || {};
    if (!social?.reservations_enabled) {
      return NextResponse.json({ ok: false, message: 'Las reservas no estan activadas' }, { status: 400 });
    }
    const capacity = Number(social?.reservations_capacity ?? 0);
    const slots = parseSlots(social?.reservations_slots);
    const leadHours = Number.isFinite(social?.reservations_lead_hours) ? Number(social.reservations_lead_hours) : null;
    const maxDays = Number.isFinite(social?.reservations_max_days) ? Number(social.reservations_max_days) : null;
    const autoConfirm = social?.reservations_auto_confirm === true;
    const blockedDates: string[] = Array.isArray(social?.reservations_blocked_dates)
      ? social.reservations_blocked_dates.filter((d: any) => typeof d === 'string')
      : [];

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
    if (leadHours && leadHours > 0) {
      const minDate = Date.now() + leadHours * 60 * 60 * 1000;
      if (reservedAt.getTime() < minDate) {
        return NextResponse.json({ ok: false, message: 'La reserva debe hacerse con mas antelacion' }, { status: 400 });
      }
    }
    if (maxDays && maxDays > 0) {
      const maxDate = Date.now() + maxDays * 24 * 60 * 60 * 1000;
      if (reservedAt.getTime() > maxDate) {
        return NextResponse.json({ ok: false, message: 'La reserva es demasiado lejana en el tiempo' }, { status: 400 });
      }
    }
    if (blockedDates.includes(date)) {
      return NextResponse.json({ ok: false, message: 'No se admiten reservas en esta fecha' }, { status: 409 });
    }
    if (!isWithinSchedule(date, time, tenant.opening_hours)) {
      return NextResponse.json({ ok: false, message: 'La reserva debe estar dentro del horario de apertura' }, { status: 400 });
    }

    if (slots.length > 0) {
      const minutes = hhmmToMinutes(time);
      const slot = slots.find((s) => minutes >= hhmmToMinutes(s.from) && minutes < hhmmToMinutes(s.to));
      if (!slot) {
        return NextResponse.json({ ok: false, message: 'Fuera del horario de reservas disponible' }, { status: 400 });
      }
      const slotCapacity = slot.capacity && slot.capacity > 0 ? slot.capacity : capacity && capacity > 0 ? capacity : null;
      if (slotCapacity && slotCapacity > 0) {
        const dayStartUtc = new Date(Date.UTC(yyyy, (mm || 1) - 1, dd || 1, 0, 0, 0, 0)).toISOString();
        const dayEndUtc = new Date(Date.UTC(yyyy, (mm || 1) - 1, dd || 1, 23, 59, 59, 999)).toISOString();
        const { data: dayRes, error: dayErr } = await supabaseAdmin
          .from('reservations')
          .select('reserved_at, timezone_offset_minutes, status')
          .eq('business_id', tenant.id)
          .gte('reserved_at', dayStartUtc)
          .lte('reserved_at', dayEndUtc)
          .neq('status', 'cancelled');
        if (dayErr) throw dayErr;
        const countInSlot =
          dayRes?.filter((r) => {
            const rowOffset =
              typeof r.timezone_offset_minutes === 'number' && Number.isFinite(r.timezone_offset_minutes)
                ? r.timezone_offset_minutes
                : offsetToUse;
            const dt = new Date(r.reserved_at);
            dt.setMinutes(dt.getMinutes() + rowOffset);
            const rowMinutes = dt.getHours() * 60 + dt.getMinutes();
            const rowDate = dt.toISOString().slice(0, 10);
            return rowDate === date && rowMinutes >= hhmmToMinutes(slot.from) && rowMinutes < hhmmToMinutes(slot.to);
          }).length ?? 0;
        if (countInSlot >= slotCapacity) {
          return NextResponse.json(
            { ok: false, message: 'La franja horaria ya no tiene disponibilidad. Elige otra hora.' },
            { status: 409 }
          );
        }
      }
    } else if (capacity && capacity > 0) {
      // Compatibilidad con el comportamiento anterior (sin franjas personalizadas)
      const { count, error: countErr } = await supabaseAdmin
        .from('reservations')
        .select('*', { head: true, count: 'exact' })
        .eq('business_id', tenant.id)
        .eq('reserved_at', reservedAt.toISOString())
        .neq('status', 'cancelled');
      if (countErr) throw countErr;
      if ((count ?? 0) >= capacity) {
        return NextResponse.json(
          { ok: false, message: 'La franja horaria ya no tiene disponibilidad. Elige otra hora.' },
          { status: 409 }
        );
      }
    }

    const status = autoConfirm ? 'confirmed' : 'pending';
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
        status,
      })
      .select('id')
      .maybeSingle();
    if (error) throw error;

    const reservedFor = formatReservationTimestamp(reservedAt, tzOffsetMinutes);
    const businessEmail = social?.reservations_email || (tenant as any)?.email || null;
    const businessPhone = (tenant as any)?.phone || (tenant as any)?.whatsapp || null;
    const businessAddress = [tenant.address_line, tenant.postal_code, tenant.city].filter(Boolean).join(', ') || undefined;

    if (email) {
      await sendReservationCustomerEmail({
        businessName: tenant.name || 'PideLocal',
        businessAddress,
        businessLogoUrl: tenant.logo_url || undefined,
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        businessPhone,
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

    const telegramResEnabled = !!social?.telegram_reservations_enabled;
    const telegramResToken =
      social?.telegram_reservations_bot_token || social?.telegram_bot_token || '';
    const telegramResChatId =
      social?.telegram_reservations_chat_id || social?.telegram_chat_id || '';
    if (telegramResEnabled && telegramResToken && telegramResChatId) {
      const slug = (tenant as any)?.slug || '';
      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
      let replyMarkup: any;
      const inlineButtons: Array<Array<{ text: string; url: string }>> = [];
      if (slug && baseUrl && inserted?.id) {
        const ts = Date.now().toString();
        const confirmSig = createTelegramSignature(String(slug), String(inserted.id), ts, "confirm");
        const cancelSig = createTelegramSignature(String(slug), String(inserted.id), ts, "cancel");
        if (confirmSig) {
          const confirmUrl = `${baseUrl}/api/reservations/telegram-status?tenant=${encodeURIComponent(
            slug
          )}&reservation=${encodeURIComponent(String(inserted.id))}&ts=${ts}&sig=${confirmSig}&action=confirm`;
          inlineButtons.push([{ text: '✅ Confirmar', url: confirmUrl }]);
        }
        if (cancelSig) {
          const cancelUrl = `${baseUrl}/api/reservations/telegram-status?tenant=${encodeURIComponent(
            slug
          )}&reservation=${encodeURIComponent(String(inserted.id))}&ts=${ts}&sig=${cancelSig}&action=cancel`;
          inlineButtons.push([{ text: '❌ Cancelar', url: cancelUrl }]);
        }
        if (inlineButtons.length) {
          replyMarkup = { inline_keyboard: inlineButtons };
        }
      }
      const text = buildReservationTelegramMessage({
        businessName: tenant.name || undefined,
        reservedFor,
        partySize: people,
        customerName: name,
        customerPhone: phone,
        customerEmail: email || null,
        notes,
      });
      if (text) {
        await sendTelegramMessage({
          token: telegramResToken,
          chatId: telegramResChatId,
          text,
          replyMarkup,
        });
      }
    }

    return NextResponse.json({ ok: true, id: inserted?.id, message: 'Reserva enviada correctamente' });
  } catch (e: any) {
    console.error('[reservations] error', e);
    return NextResponse.json({ ok: false, message: e?.message || 'No se pudo crear la reserva' }, { status: 400 });
  }
}
