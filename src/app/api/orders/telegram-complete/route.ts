import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyTelegramSignature } from "@/lib/telegram";

const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 2; // 2 días

function htmlResponse(body: string, status = 200) {
  const markup = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Estado del pedido</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 32px; background: #f5f5f5; color: #111; }
    .card { background: #fff; border-radius: 12px; padding: 24px; max-width: 420px; margin: 0 auto; box-shadow: 0 8px 30px rgba(0,0,0,0.08); text-align: center; }
    h1 { font-size: 1.4rem; margin-bottom: 0.6rem; }
    p { font-size: 0.95rem; margin: 0.2rem 0; }
    .ok { color: #0a6847; }
    .error { color: #b42318; }
    .small { font-size: 0.85rem; color: #667085; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="card">${body}</div>
</body>
</html>`;
  return new NextResponse(markup, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("tenant") || "").toLowerCase();
  const orderId = url.searchParams.get("order") || "";
  const ts = url.searchParams.get("ts") || "";
  const sig = url.searchParams.get("sig") || "";

  if (!slug || !orderId || !ts || !sig) {
    return htmlResponse('<h1 class="error">Enlace inválido</h1><p>Faltan parámetros.</p>', 400);
  }

  const tsNumber = Number(ts);
  if (!Number.isFinite(tsNumber) || Date.now() - tsNumber > MAX_AGE_MS) {
    return htmlResponse('<h1 class="error">Enlace caducado</h1><p>Solicita un pedido nuevo.</p>', 400);
  }

  if (!verifyTelegramSignature(slug, orderId, ts, sig)) {
    return htmlResponse('<h1 class="error">Firma inválida</h1><p>No podemos validar este enlace.</p>', 400);
  }

  const { data: biz } = await supabaseAdmin
    .from("businesses")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();

  if (!biz?.id) {
    return htmlResponse('<h1 class="error">Negocio no encontrado</h1>', 404);
  }

  const { error } = await supabaseAdmin
    .from("orders")
    .update({ status: "delivered" })
    .eq("id", orderId)
    .eq("business_id", biz.id);

  if (error) {
    return htmlResponse('<h1 class="error">No se pudo actualizar el pedido</h1><p>Inténtalo de nuevo.</p>', 500);
  }

  return htmlResponse(
    `<h1 class="ok">Pedido marcado como entregado</h1>
    <p>El pedido se actualizó correctamente en ${biz.name || "el negocio"}.</p>
    <p class="small">Ya puedes cerrar esta pestaña.</p>`
  );
}
