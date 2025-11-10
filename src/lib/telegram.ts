type TelegramSendParams = {
  token: string;
  chatId: string;
  text: string;
};

type OrderTelegramPayload = {
  businessName?: string;
  code?: string;
  total?: number;
  items?: Array<{ name: string; qty: number; price: number }>;
  paymentMethod?: string;
  pickupTime?: string | null;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string | null;
  notes?: string | null;
};

function formatCurrency(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "";
  try {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
  } catch {
    return `${value.toFixed(2)} EUR`;
  }
}

function sanitize(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function buildOrderTelegramMessage(payload: OrderTelegramPayload): string {
  const parts: string[] = [];
  const title = payload.businessName ? `🍕 Nuevo pedido en ${payload.businessName}` : "🍕 Nuevo pedido";
  parts.push(title);
  if (payload.code) parts.push(`Código: #${payload.code}`);
  if (payload.pickupTime) {
    const when = new Date(payload.pickupTime);
    const formatted = Number.isNaN(when.getTime())
      ? payload.pickupTime
      : when.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
    parts.push(`Entrega: ${formatted}`);
  }
  if (payload.paymentMethod) {
    parts.push(`Pago: ${payload.paymentMethod === "card" ? "Tarjeta" : "Efectivo"}`);
  }
  const customer: string[] = [];
  if (payload.customerName) customer.push(payload.customerName);
  if (payload.customerPhone) customer.push(payload.customerPhone);
  if (payload.customerEmail) customer.push(payload.customerEmail);
  if (customer.length) parts.push(`Cliente: ${customer.join(" · ")}`);

  if (payload.items && payload.items.length > 0) {
    parts.push("");
    parts.push("Detalle:");
    payload.items.slice(0, 20).forEach((item) => {
      const price = typeof item.price === "number" ? formatCurrency(item.price) : "";
      parts.push(`• ${item.qty} × ${sanitize(item.name)}${price ? ` (${price})` : ""}`);
    });
    if (payload.items.length > 20) {
      parts.push(`• … y ${payload.items.length - 20} productos más`);
    }
  }

  if (typeof payload.total === "number") {
    parts.push("");
    parts.push(`Total: ${formatCurrency(payload.total)}`);
  }

  if (payload.notes) {
    parts.push("");
    parts.push(`Notas: ${payload.notes}`);
  }

  return parts.join("\n").trim();
}

export async function sendTelegramMessage({ token, chatId, text }: TelegramSendParams) {
  if (!token || !chatId || !text) return;
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });
  } catch (error) {
    console.error("[telegram] sendMessage error:", error);
  }
}
