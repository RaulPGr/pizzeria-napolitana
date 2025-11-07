import { Resend } from "resend";

type CommonParams = {
  businessName: string;
  businessAddress?: string;
  businessLogoUrl?: string;
  businessPhone?: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  partySize: number;
  reservedFor: string; // formatted date/time
  notes?: string | null;
};

function buildHeaderHtml(name: string, logo?: string) {
  if (!logo) {
    return `<h2 style="margin:0 0 16px">${name}</h2>`;
  }
  return `
    <div style="margin-bottom:16px;">
      <img src="${logo}" alt="${name}" style="max-height:70px;object-fit:contain;display:block;" />
    </div>
    <h2 style="margin:0 0 16px">${name}</h2>
  `;
}

export async function sendReservationCustomerEmail({
  businessName,
  businessAddress,
  businessLogoUrl,
  businessPhone,
  customerName,
  customerEmail,
  customerPhone,
  partySize,
  reservedFor,
  notes,
}: CommonParams & { customerEmail: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.warn("[email] Falta RESEND_API_KEY o EMAIL_FROM; omito envio (cliente reserva).");
    return;
  }
  const resend = new Resend(apiKey);

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto;line-height:1.5">
      ${buildHeaderHtml(businessName, businessLogoUrl)}
      <p>Hola ${customerName || "cliente"}, hemos recibido tu solicitud de reserva.</p>
      <p><strong>Fecha y hora:</strong> ${reservedFor}</p>
      <p><strong>Comensales:</strong> ${partySize}</p>
      ${businessAddress ? `<p><strong>Direccion:</strong> ${businessAddress}</p>` : ""}
      ${notes ? `<p><strong>Notas que nos enviaste:</strong> ${notes}</p>` : ""}
      ${
        businessPhone
          ? `<p>Si necesitas modificarla, llamanos al ${businessPhone}.</p>`
          : "<p>Si necesitas modificarla, contactanos respondiendo a este correo.</p>"
      }
      <p style="margin-top:24px;font-size:12px;color:#666">Este email se envio automaticamente desde pedidos.pidelocal.es</p>
    </div>
  `;

  await resend.emails.send({
    from,
    to: [customerEmail],
    subject: `Hemos recibido tu reserva en ${businessName}`,
    html,
  });
}

export async function sendReservationBusinessEmail({
  businessName,
  businessAddress,
  businessLogoUrl,
  customerName,
  customerEmail,
  customerPhone,
  partySize,
  reservedFor,
  notes,
  businessTargetEmail,
}: CommonParams & { businessTargetEmail: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.warn("[email] Falta RESEND_API_KEY o EMAIL_FROM; omito envio (negocio reserva).");
    return;
  }
  const resend = new Resend(apiKey);

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto;line-height:1.5">
      ${buildHeaderHtml(businessName, businessLogoUrl)}
      <p>Tienes una nueva solicitud de reserva.</p>
      <p><strong>Fecha y hora:</strong> ${reservedFor}</p>
      <p><strong>Comensales:</strong> ${partySize}</p>
      <p><strong>Cliente:</strong> ${customerName}</p>
      <p><strong>Telefono:</strong> ${customerPhone}</p>
      ${customerEmail ? `<p><strong>Email:</strong> ${customerEmail}</p>` : ""}
      ${notes ? `<p><strong>Notas:</strong> ${notes}</p>` : ""}
      ${businessAddress ? `<p><strong>Direccion del local:</strong> ${businessAddress}</p>` : ""}
      <p style="margin-top:24px;font-size:12px;color:#666">Este email se envio automaticamente desde pedidos.pidelocal.es</p>
    </div>
  `;

  await resend.emails.send({
    from,
    to: [businessTargetEmail],
    subject: `Nueva reserva recibida en ${businessName}`,
    html,
  });
}

export async function sendReservationStatusEmail({
  businessName,
  businessAddress,
  businessLogoUrl,
  customerName,
  customerEmail,
  customerPhone,
  partySize,
  reservedFor,
  notes,
  status,
}: CommonParams & { customerEmail: string; status: "confirmed" | "cancelled" }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.warn("[email] Falta RESEND_API_KEY o EMAIL_FROM; omito envio (estado reserva).");
    return;
  }
  const resend = new Resend(apiKey);

  const title =
    status === "confirmed"
      ? "Tu reserva ha sido confirmada"
      : "Actualizacion sobre tu reserva";
  const message =
    status === "confirmed"
      ? "Tu mesa esta lista, te esperamos."
      : "Lamentamos informarte de que la reserva ha sido cancelada.";

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto;line-height:1.5">
      ${buildHeaderHtml(businessName, businessLogoUrl)}
      <h3 style="margin-bottom:8px">${title}</h3>
      <p>${message}</p>
      <p><strong>Cliente:</strong> ${customerName}</p>
      <p><strong>Telefono:</strong> ${customerPhone}</p>
      <p><strong>Fecha y hora:</strong> ${reservedFor}</p>
      <p><strong>Comensales:</strong> ${partySize}</p>
      ${businessAddress ? `<p><strong>Direccion:</strong> ${businessAddress}</p>` : ""}
      ${notes ? `<p><strong>Notas que enviaste:</strong> ${notes}</p>` : ""}
      <p style="margin-top:24px;font-size:12px;color:#666">Este email se envio automaticamente desde pedidos.pidelocal.es</p>
    </div>
  `;

  await resend.emails.send({
    from,
    to: [customerEmail],
    subject: `${businessName} - Actualizacion de reserva`,
    html,
  });
}
