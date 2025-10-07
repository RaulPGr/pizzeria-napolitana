import { NextResponse } from 'next/server';

type Ctx = { params: { id: string } };

// GET /api/orders/:id
export async function GET(_req: Request, { params }: Ctx) {
  const id = String(params.id || '');
  return NextResponse.json(
    { ok: true, id },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

// PATCH /api/orders/:id
export async function PATCH(req: Request, { params }: Ctx) {
  const id = String(params.id || '');
  const body = await req.json().catch(() => ({}));
  return NextResponse.json(
    { ok: true, id, body },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

// DELETE /api/orders/:id
export async function DELETE(_req: Request, { params }: Ctx) {
  const id = String(params.id || '');
  return NextResponse.json(
    { ok: true, id },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
