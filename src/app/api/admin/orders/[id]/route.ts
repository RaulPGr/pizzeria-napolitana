// src/app/api/orders/[id]/route.ts
import { NextResponse } from 'next/server';

export async function GET(_req: Request, context: any) {
  const id = String(context?.params?.id ?? '');
  return NextResponse.json({ ok: true, id }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(req: Request, context: any) {
  const id = String(context?.params?.id ?? '');
  const data = await req.json().catch(() => ({}));
  return NextResponse.json({ ok: true, id, updated: data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(_req: Request, context: any) {
  const id = String(context?.params?.id ?? '');
  return NextResponse.json({ ok: true, id, deleted: true }, { headers: { 'Cache-Control': 'no-store' } });
}
