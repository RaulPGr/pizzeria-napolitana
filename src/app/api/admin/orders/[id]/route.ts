import { NextResponse } from 'next/server';

// GET /api/admin/orders/:id
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id ?? '';
  return NextResponse.json(
    { ok: true, id },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

// PATCH /api/admin/orders/:id
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = params.id ?? '';
  const body = await req.json().catch(() => ({}));
  return NextResponse.json(
    { ok: true, id, body },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

// DELETE /api/admin/orders/:id
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id ?? '';
  return NextResponse.json(
    { ok: true, id },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
