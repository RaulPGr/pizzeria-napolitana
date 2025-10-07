import { NextResponse } from 'next/server';

// GET /api/orders/:id
export async function GET(_req, ctx) {
  const id = String(ctx?.params?.id || '');
  return NextResponse.json({ ok: true, id }, { headers: { 'Cache-Control': 'no-store' } });
}

// PATCH /api/orders/:id
export async function PATCH(req, ctx) {
  const id = String(ctx?.params?.id || '');
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({ ok: true, id, body }, { headers: { 'Cache-Control': 'no-store' } });
}

// DELETE /api/orders/:id
export async function DELETE(_req, ctx) {
  const id = String(ctx?.params?.id || '');
  return NextResponse.json({ ok: true, id }, { headers: { 'Cache-Control': 'no-store' } });
}
