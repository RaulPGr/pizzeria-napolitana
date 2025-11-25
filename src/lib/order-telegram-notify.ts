"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildOrderTelegramMessage, createTelegramSignature, sendTelegramMessage } from "@/lib/telegram";

type NotifyResult =
  | { ok: true }
  | { ok: false; skip?: boolean; error: string };

function appBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "";
}

export async function notifyOrderViaTelegram(orderId: string, socialOverride?: Record<string, any>): Promise<NotifyResult> {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select(
      `
        id,
        code,
        total_cents,
        payment_method,
        pickup_at,
        notes,
        customer_name,
        customer_phone,
        customer_email,
        telegram_notify_errors
      `
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    return { ok: false, error: error?.message || "Pedido no encontrado" };
  }

  const social = socialOverride || {};
  const telegramEnabled = !!social?.telegram_notifications_enabled;
  const telegramToken = (
    social?.telegram_bot_token ||
    social?.telegram_reservations_bot_token ||
    ""
  ).toString().trim();
  const telegramChatId = (
    social?.telegram_chat_id ||
    social?.telegram_reservations_chat_id ||
    ""
  ).toString().trim();
  if (!telegramEnabled || !telegramToken || !telegramChatId) {
    console.warn("[telegram] skip order", order.id, {
      telegramEnabled,
      hasToken: Boolean(telegramToken),
      hasChat: Boolean(telegramChatId),
    });
    return { ok: false, skip: true, error: "Telegram no configurado para este negocio" };
  }

  const { data: orderItems, error: itemsErr } = await supabaseAdmin
    .from("order_items")
    .select("name, quantity, unit_price_cents, order_item_options(name_snapshot, group_name_snapshot, price_delta_snapshot)")
    .eq("order_id", orderId);
  if (itemsErr) {
    return { ok: false, error: itemsErr.message };
  }

  const itemsSimple = (orderItems || []).map((it: any) => {
    const options = Array.isArray(it.order_item_options)
      ? it.order_item_options.map((opt: any) => {
          const base = opt.group_name_snapshot ? `${opt.group_name_snapshot}: ${opt.name_snapshot}` : opt.name_snapshot;
          const delta = Number(opt.price_delta_snapshot || 0);
          if (delta) {
            const formatted = delta.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
            const sign = delta > 0 ? "+" : "-";
            return `${base} (${sign}${formatted})`;
          }
          return base;
        })
      : [];
    return {
      name: it.name,
      qty: it.quantity,
      price: (it.unit_price_cents || 0) / 100,
      options,
    };
  });

  const slug = (social as any)?.slug || "";
  const baseUrl = appBaseUrl();
  let replyMarkup: any;
  if (slug && baseUrl) {
    const ts = Date.now().toString();
    const confirmSig = createTelegramSignature(slug, order.id, ts, "delivered");
    const cancelSig = createTelegramSignature(slug, order.id, ts, "cancelled");
    const buttons: Array<Array<{ text: string; url: string }>> = [];
    if (confirmSig) {
      const confirmUrl = `${baseUrl}/api/orders/telegram-complete?tenant=${encodeURIComponent(
        slug
      )}&order=${encodeURIComponent(order.id)}&ts=${ts}&sig=${confirmSig}&action=delivered`;
      buttons.push([{ text: "✅ Marcar entregado", url: confirmUrl }]);
    }
    if (cancelSig) {
      const cancelUrl = `${baseUrl}/api/orders/telegram-complete?tenant=${encodeURIComponent(
        slug
      )}&order=${encodeURIComponent(order.id)}&ts=${ts}&sig=${cancelSig}&action=cancelled`;
      buttons.push([{ text: "❌ Cancelar pedido", url: cancelUrl }]);
    }
    if (buttons.length) replyMarkup = { inline_keyboard: buttons };
  }

  const text = buildOrderTelegramMessage({
    businessName: (social as any)?.businessName || undefined,
    code: order.code || undefined,
    total: (order.total_cents || 0) / 100,
    items: itemsSimple,
    paymentMethod: order.payment_method || undefined,
    pickupTime: order.pickup_at || undefined,
    customerName: order.customer_name,
    customerPhone: order.customer_phone || undefined,
    customerEmail: order.customer_email || undefined,
    notes: order.notes || undefined,
  });

  if (!text) {
    return { ok: false, skip: true, error: "Mensaje vacío" };
  }

  try {
    await sendTelegramMessage({
      token: telegramToken,
      chatId: telegramChatId,
      text,
      replyMarkup,
    });

    await supabaseAdmin
      .from("orders")
      .update({
        telegram_notified_at: new Date().toISOString(),
        telegram_notify_errors: 0,
        telegram_last_error: null,
      })
      .eq("id", order.id);

    return { ok: true };
  } catch (err: any) {
    const message = err?.message || "Fallo al enviar Telegram";
    await supabaseAdmin
      .from("orders")
      .update({
        telegram_notify_errors: (order.telegram_notify_errors || 0) + 1,
        telegram_last_error: message,
      })
      .eq("id", order.id);
    return { ok: false, error: message };
  }
}
