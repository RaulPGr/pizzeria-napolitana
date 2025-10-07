import { NextRequest, NextResponse } from 'next/server';

function pickId(params: Record<string, string | string[]>) {
  const v = params?.id;
  return Array.isArray(v) ? v[0] : (v ?? '');
}

// GET /api/admin/orders/:id
export async function GET(_req: NextRequest, ctx: { params: Record<string, string | string[]> }) {
  const id = pickId(ctx.params);
  return NextResponse.json(
    { ok: true, id },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

// PATCH /api/admin/orders/:id
export async function PATCH(req: NextRequest, ctx: { params: Record<string, string | string[]> }) {
  const id = pickId(ctx.params);
  const body = await req.json().catch(() => ({}));
  return NextResponse.json(
    { ok: true, id, body },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

// DELETE /api/admin/orders/:id
export async function DELETE(_req: NextRequest, ctx: { params: Record<string, string | string[]> }) {
  const id = pickId(ctx.params);
  return NextResponse.json(
    { ok: true, id },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
