// @server-only
// Helper para enviar el email de confirmación de pedido usando Resend.
// No importa UI; se usa únicamente desde rutas del servidor.
import { Resend } from "resend";

export type OrderItem = { name: string; qty: number; price: number; options?: string[] };
export type SendOrderReceiptParams = {
  orderId: string;
  orderCode?: string; // código corto usado en el panel (p.ej., primeros chars)
  businessName: string;
  businessAddress?: string;
  businessLogoUrl?: string;
  customerEmail: string;
  customerName?: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee?: number;
  discount?: number;
  promotionName?: string;
  total: number;
  pickupTime?: string;
  deliveryAddress?: string;
  notes?: string;
  bcc?: string;
};

export type SendOrderBusinessNotificationParams = {
  orderId: string;
  orderCode?: string;
  businessName: string;
  businessAddress?: string;
  businessLogoUrl?: string;
  businessEmail: string;
  items: OrderItem[];
  total: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  pickupTime?: string;
  notes?: string;
};

const currency = (n: number) =>
  Number(n || 0).toLocaleString("es-ES", { style: "currency", currency: "EUR" });

// Timezone para formatear la hora de recogida en el email.
// Puede configurarse con EMAIL_TZ (ej.: Europe/Madrid). Por defecto Europe/Madrid.
const EMAIL_TZ = process.env.EMAIL_TZ || 'Europe/Madrid';

function formatPickup(ts: string): string {
  try {
    const d = new Date(ts);
    // Formato claro día/mes/año y hora 24h (local al TZ configurado)
    return d.toLocaleString('es-ES', {
      timeZone: EMAIL_TZ,
      weekday: 'short',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch {
    return ts;
  }
}

export async function sendOrderReceiptEmail({
  orderId, orderCode, businessName, businessAddress, businessLogoUrl, customerEmail, customerName,
  items, subtotal, deliveryFee = 0, discount = 0, promotionName, total,
  pickupTime, deliveryAddress, notes, bcc
}: SendOrderReceiptParams): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      console.warn("[email] Falta RESEND_API_KEY o EMAIL_FROM; omito envío.");
      return;
    }

    const resend = new Resend(apiKey);

    const rows = items.map((it) => {
      const optionsHtml = it.options && it.options.length
        ? `<div style="margin-top:4px;font-size:12px;color:#666;">${it.options.map((opt) => `• ${opt}`).join("<br/>")}</div>`
        : "";
      return `
      <tr>
        <td>${it.name}${optionsHtml}</td>
        <td align="center">${it.qty}</td>
        <td align="right">${currency(it.price * it.qty)}</td>
      </tr>
    `;
    }).join("");

    const ticket = `#${(orderCode ?? (orderId?.toString().split('-')[0] || '')).toString().slice(0, 7)}`;

    const logoSection = businessLogoUrl
      ? `<div style="margin-bottom:16px;"><img src="${businessLogoUrl}" alt="${businessName}" style="max-height:70px; object-fit:contain;" /></div>`
      : "";

    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto;line-height:1.5">
        ${logoSection}
        <h2>${businessName} – Hemos recibido tu pedido</h2>
        <p>Hola ${customerName ?? "cliente"}, gracias por tu pedido.</p>
        <p><strong>Nº pedido:</strong> ${ticket}</p>
        ${businessAddress ? `<p><strong>Direccion del negocio:</strong> ${businessAddress}</p>` : ""}

        <table width="100%" cellpadding="8" style="border-collapse:collapse;border-top:1px solid #eee;border-bottom:1px solid #eee">
          <thead>
            <tr>
              <th align="left">Producto</th>
              <th align="center">Ud.</th>
              <th align="right">Importe</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr><td></td><td align="right">Subtotal</td><td align="right">${currency(subtotal)}</td></tr>
            ${discount ? `<tr><td></td><td align="right">Descuento${promotionName ? ` (${promotionName})` : ""}</td><td align="right">-${currency(discount)}</td></tr>` : ""}
            ${deliveryFee ? `<tr><td></td><td align="right">Envío</td><td align="right">${currency(deliveryFee)}</td></tr>` : ""}
            <tr><td></td><td align="right"><strong>Total</strong></td><td align="right"><strong>${currency(total)}</strong></td></tr>
          </tfoot>
        </table>

        ${pickupTime ? `<p><strong>Hora estimada:</strong> ${formatPickup(pickupTime)}</p>` : ""}
        ${deliveryAddress ? `<p><strong>Dirección de entrega:</strong> ${deliveryAddress}</p>` : ""}
        ${notes ? `<p><strong>Notas:</strong> ${notes}</p>` : ""}

        <p style="color:#888;font-size:12px">© ${new Date().getFullYear()} PideLocal</p>
      </div>
    `;

    await resend.emails.send({
      from,
      to: [customerEmail],
      ...(process.env.EMAIL_BCC || bcc ? { bcc: [process.env.EMAIL_BCC || (bcc as string)] } : {}),
      subject: `Hemos recibido tu pedido ${ticket} en ${businessName}`,
      html,
    });
  } catch (err) {
    console.error("[email] Error enviando confirmación:", err);
    // Importante: nunca relanzar el error; el pedido no debe fallar por el email.
  }
}

export async function sendOrderBusinessNotificationEmail({
  orderId,
  orderCode,
  businessName,
  businessAddress,
  businessLogoUrl,
  businessEmail,
  items,
  total,
  customerName,
  customerPhone,
  customerEmail,
  pickupTime,
  notes,
}: SendOrderBusinessNotificationParams): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      console.warn('[email] Falta RESEND_API_KEY o EMAIL_FROM; omito envio (alerta negocio).');
      return;
    }
    const resend = new Resend(apiKey);

    const rows = items.map((it) => {
      const optionsHtml = it.options && it.options.length
        ? `<div style="margin-top:4px;font-size:12px;color:#666;">${it.options.map((opt) => `• ${opt}`).join("<br/>")}</div>`
        : "";
      return `
      <tr>
        <td>${it.name}${optionsHtml}</td>
        <td align="center">${it.qty}</td>
        <td align="right">${currency(it.price * it.qty)}</td>
      </tr>
    `;
    }).join('');
    const ticket = `#${(orderCode ?? (orderId?.toString().split('-')[0] || '')).toString().slice(0, 7)}`;
    const logoSection = businessLogoUrl
      ? `<div style="margin-bottom:16px;"><img src="${businessLogoUrl}" alt="${businessName}" style="max-height:70px; object-fit:contain;" /></div>`
      : '';

    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto;line-height:1.5">
        ${logoSection}
        <h2>Nuevo pedido recibido en ${businessName}</h2>
        <p><strong>Nº pedido:</strong> ${ticket}</p>
        ${businessAddress ? `<p><strong>Direccion:</strong> ${businessAddress}</p>` : ''}

        <p><strong>Cliente:</strong> ${customerName}</p>
        <p><strong>Telefono:</strong> ${customerPhone}</p>
        ${customerEmail ? `<p><strong>Email:</strong> ${customerEmail}</p>` : ''}

        <table width="100%" cellpadding="8" style="border-collapse:collapse;border-top:1px solid #eee;border-bottom:1px solid #eee;margin-top:16px">
          <thead>
            <tr>
              <th align="left">Producto</th>
              <th align="center">Ud.</th>
              <th align="right">Importe</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr><td></td><td align="right"><strong>Total</strong></td><td align="right"><strong>${currency(total)}</strong></td></tr>
          </tfoot>
        </table>

        ${pickupTime ? `<p style="margin-top:16px;"><strong>Hora estimada:</strong> ${formatPickup(pickupTime)}</p>` : ''}
        ${notes ? `<p><strong>Notas del cliente:</strong> ${notes}</p>` : ''}

        <p style="margin-top:24px;font-size:12px;color:#666">
          Revisa el panel de pedidos para gestionarlo. Este aviso se envio automaticamente desde pedidos.pidelocal.es
        </p>
      </div>
    `;

    await resend.emails.send({
      from,
      to: [businessEmail],
      subject: `Nuevo pedido ${ticket} en ${businessName}`,
      html,
    });
  } catch (err) {
    console.error('[email] Error enviando alerta negocio:', err);
  }
}
