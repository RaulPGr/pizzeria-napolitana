import { NextResponse } from 'next/server';

/**
 * GET /api/admin/orders/[orderId]/items
 */
export async function GET(
  _req: Request,
  { params }: { params: { orderId: string } }
) {
  const { orderId } = params;

  // TODO: sustituir por lectura real desde BD
  const items: unknown[] = [];

  return NextResponse.json(
    { ok: true, orderId, items },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

/**
 * POST /api/admin/orders/[orderId]/items
 */
export async function POST(
  req: Request,
  { params }: { params: { orderId: string } }
) {
  const { orderId } = params;

  try {
    const body = await req.json().catch(() => ({}));
    // TODO: insertar en BD y devolver el item creado
    return NextResponse.json({ ok: true, orderId, created: body }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/admin/orders/[orderId]/items
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { orderId: string } }
) {
  const { orderId } = params;

  // TODO: borrar en BD según lo que envíe el cliente
  return NextResponse.json({ ok: true, orderId });
}
