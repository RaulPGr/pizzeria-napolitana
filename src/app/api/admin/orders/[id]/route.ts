// src/app/api/orders/[id]/route.ts
import { NextResponse } from 'next/server';

// GET /api/orders/:id
export async function GET(_req: Request, ctx: any) {
  const id = String(ctx?.params?.id ?? '');

  // TODO: tu lógica real para obtener el pedido por id
  // const order = await db.getOrder(id);

  return NextResponse.json(
    { ok: true, id /*, order*/ },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

// PATCH /api/orders/:id
export async function PATCH(req: Request, ctx: any) {
  const id = String(ctx?.params?.id ?? '');
  const body = await req.json().catch(() => ({}));

  // TODO: tu lógica real para actualizar el pedido
  // const updated = await db.updateOrder(id, body);

  return NextResponse.json(
    { ok: true, id, body /*, updated*/ },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

// DELETE /api/orders/:id
export async function DELETE(_req: Request, ctx: any) {
  const id = String(ctx?.params?.id ?? '');

  // TODO: tu lógica real para eliminar el pedido
  // await db.deleteOrder(id);

  return NextResponse.json(
    { ok: true, id },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
