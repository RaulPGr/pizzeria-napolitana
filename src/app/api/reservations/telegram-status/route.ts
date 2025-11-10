import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyTelegramSignature } from "@/lib/telegram";
import { sendReservationStatusEmail } from "@/lib/email/sendReservationEmails";

const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 2;

function formatReservationTimestamp(dateISO: string, tzOffsetMinutes?: number | null) {
  try {
    const dt = new Date(dateISO);
    if (typeof tzOffsetMinutes === "number" && Number.isFinite(tzOffsetMinutes)) {
      dt.setMinutes(dt.getMinutes() - tzOffsetMinutes);
    }
    return dt.toLocaleString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateISO;
  }
}

function render(body: string, status = 200) {
  return new NextResponse(
    `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Reserva</title>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:#f5f5f5; padding:32px; }
      .card { background:#fff; border-radius:14px; max-width:420px; margin:0 auto; padding:26px; box-shadow:0 8px 30px rgba(0,0,0,0.08); text-align:center; }
      h1 { font-size:1.35rem; margin-bottom:.5rem; }
      p { margin:.4rem 0; color:#475467; font-size:.95rem; }
      .ok { color:#0f8a3d; }
      .error { color:#b42318; }
      .small { margin-top:1rem; font-size:.85rem; color:#98a2b3; }
    </style>
  </head>
  <body>
    <div class="card">${body}</div>
  </body>
</html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("tenant") || "").toLowerCase();
  const reservationId = url.searchParams.get("reservation") || "";
  const ts = url.searchParams.get("ts") || "";
  const sig = url.searchParams.get("sig") || "";
  const action = (url.searchParams.get("action") || "confirm").toLowerCase();

  if (!slug || !reservationId || !ts || !sig) {
    return render('<h1 class="error">Enlace inválido</h1><p>Faltan datos para actualizar la reserva.</p>', 400);
  }
  const tsNumber = Number(ts);
  if (!Number.isFinite(tsNumber) || Date.now() - tsNumber > MAX_AGE_MS) {
    return render('<h1 class="error">Enlace caducado</h1><p>Solicita una nueva reserva.</p>', 400);
  }
  if (!verifyTelegramSignature(slug, reservationId, ts, sig, action === "cancel" ? "cancel" : "confirm")) {
    return render('<h1 class="error">Firma inválida</h1><p>No podemos validar este enlace.</p>', 400);
  }

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id, name, address_line, city, postal_code, logo_url")
    .eq("slug", slug)
    .maybeSingle();
  if (!business?.id) {
    return render('<h1 class="error">Negocio no encontrado</h1>', 404);
  }

  const { data: reservation } = await supabaseAdmin
    .from("reservations")
    .select(
      "id, status, customer_name, customer_email, customer_phone, party_size, reserved_at, notes, timezone_offset_minutes"
    )
    .eq("id", reservationId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!reservation) {
    return render('<h1 class="error">Reserva no encontrada</h1>', 404);
  }

  if (reservation.status === (action === "cancel" ? "cancelled" : "confirmed")) {
    return render(
      `<h1 class="ok">Ya estaba ${action === "cancel" ? "cancelada" : "confirmada"}</h1><p>No era necesario repetir la acción.</p>`
    );
  }

  const { error } = await supabaseAdmin
    .from("reservations")
    .update({ status: action === "cancel" ? "cancelled" : "confirmed" })
    .eq("id", reservationId)
    .eq("business_id", business.id);
  if (error) {
    return render('<h1 class="error">No se pudo actualizar</h1><p>Inténtalo de nuevo.</p>', 500);
  }

  if (reservation.customer_email) {
    const address = [business.address_line, business.postal_code, business.city].filter(Boolean).join(", ") || undefined;
    await sendReservationStatusEmail({
      businessName: business.name || "PideLocal",
      businessAddress: address,
      businessLogoUrl: business.logo_url || undefined,
      customerName: reservation.customer_name,
      customerEmail: reservation.customer_email,
      partySize: reservation.party_size,
      reservedFor: formatReservationTimestamp(reservation.reserved_at, reservation.timezone_offset_minutes ?? null),
      notes: reservation.notes,
      status: action === "cancel" ? "cancelled" : "confirmed",
      customerPhone: reservation.customer_phone,
    });
  }

  return render(
    `<h1 class="ok">Reserva ${action === "cancel" ? "cancelada" : "confirmada"}</h1>
     <p>La reserva ha quedado ${action === "cancel" ? "cancelada" : "confirmada"} en ${business.name || "el negocio"}.</p>
     <p class="small">Puedes cerrar esta pestaña.</p>`
  );
}
