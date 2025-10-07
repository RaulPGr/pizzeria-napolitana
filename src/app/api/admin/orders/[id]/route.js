import { NextResponse } from 'next/server';

const noStore = { headers: { 'Cache-Control': 'no-store' } };

function pickId(params) {
  const v = params?.id;
  return Array.isArray(v) ? v[0] : (v ?? '');
}

// GET /api/admin/orders/:id
export async function GET(_req, { params }) {
  const id = pickId(params);
  return NextResponse.json({ ok: true, id }, noStore);
}

// PATCH /api/admin/orders/:id
export async function PATCH(req, { params }) {
  const id = pickId(params);
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({ ok: true, id, body }, noStore);
}

// DELETE /api/admin/orders/:id
export async function DELETE(_req, { params }) {
  const id = pickId(params);
  return NextResponse.json({ ok: true, id }, noStore);
}
