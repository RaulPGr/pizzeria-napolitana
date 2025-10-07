import { NextResponse } from 'next/server';

type Ctx = { params: { orderId: string } };

/**
 * GET /api/admin/orders/[orderId]/items
 * Devuelve los items del pedido. (Placeholder: lista vacía)
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { orderId } = params;

  // TODO: sustituir por lectura real desde tu BD (Supabase, etc.)
  const items: unknown[] = [];

  return NextResponse.json(
    { ok: true, orderId, items },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/**
 * POST /api/admin/orders/[orderId]/items
 * Crea un item para el pedido. (Placeholder: eco del body)
 */
export async function POST(req: Request, { params }: Ctx) {
  const { orderId } = params;

  try {
    const body = await req.json().catch(() => ({}));

    // TODO: insertar en BD y devolver el item creado
    return NextResponse.json(
      { ok: true, orderId, created: body },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 400 },
    );
  }
}

/**
 * DELETE /api/admin/orders/[orderId]/items
 * Elimina items del pedido. (Placeholder simple)
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { orderId } = params;

  // TODO: borrar en BD según lo que envíe el cliente (id del item, etc.)
  return NextResponse.json({ ok: true, orderId });
}
