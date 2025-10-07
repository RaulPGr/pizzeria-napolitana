import { NextResponse } from 'next/server';

const noStore = { headers: { 'Cache-Control': 'no-store' } };

function pickId(params) {
  const v = params?.id;
  return Array.isArray(v) ? v[0] : (v ?? '');
}

// PATCH /api/orders/:id/status
export async function PATCH(req, { params }) {
  const id = pickId(params);
  const body = await req.json().catch(() => ({}));
  // body debería traer algo como { status: '...' }
  return NextResponse.json({ ok: true, id, ...body }, noStore);
}

// (opcional) GET /api/orders/:id/status
export async function GET(_req, { params }) {
  const id = pickId(params);
  return NextResponse.json({ ok: true, id }, noStore);
}
