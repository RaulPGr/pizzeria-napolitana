// @server-only
// Helper para enviar el email de confirmación de pedido usando Resend.
// No importa UI; se usa únicamente desde rutas del servidor.
import { Resend } from "resend";

export type OrderItem = { name: string; qty: number; price: number };
export type SendOrderReceiptParams = {
  orderId: string;
  orderCode?: string; // código corto usado en el panel (p.ej., primeros chars)
  businessName: string;
  customerEmail: string;
  customerName?: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee?: number;
  discount?: number;
  total: number;
  pickupTime?: string;
  deliveryAddress?: string;
  notes?: string;
  bcc?: string;
};

const currency = (n: number) =>
  Number(n || 0).toLocaleString("es-ES", { style: "currency", currency: "EUR" });

export async function sendOrderReceiptEmail({
  orderId, orderCode, businessName, customerEmail, customerName,
  items, subtotal, deliveryFee = 0, discount = 0, total,
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

    const rows = items.map((it) => `
      <tr>
        <td>${it.name}</td>
        <td align="center">${it.qty}</td>
        <td align="right">${currency(it.price * it.qty)}</td>
      </tr>
    `).join("");

    const ticket = `#${(orderCode ?? (orderId?.toString().split('-')[0] || '')).toString().slice(0, 12)}`;

    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto;line-height:1.5">
        <h2>${businessName} – Hemos recibido tu pedido</h2>
        <p>Hola ${customerName ?? "cliente"}, gracias por tu pedido.</p>
        <p><strong>Nº pedido:</strong> ${ticket}</p>

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
            ${discount ? `<tr><td></td><td align="right">Descuento</td><td align="right">-${currency(discount)}</td></tr>` : ""}
            ${deliveryFee ? `<tr><td></td><td align="right">Envío</td><td align="right">${currency(deliveryFee)}</td></tr>` : ""}
            <tr><td></td><td align="right"><strong>Total</strong></td><td align="right"><strong>${currency(total)}</strong></td></tr>
          </tfoot>
        </table>

        ${pickupTime ? `<p><strong>Hora estimada:</strong> ${pickupTime}</p>` : ""}
        ${deliveryAddress ? `<p><strong>Dirección de entrega:</strong> ${deliveryAddress}</p>` : ""}
        ${notes ? `<p><strong>Notas:</strong> ${notes}</p>` : ""}

        <p style="margin-top:16px">Si necesitas ayuda, responde a este correo.</p>
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
