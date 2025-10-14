// src/app/api/orders/bulk-delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type Body = {
  ids?: string[];
  range?: { from: string; to: string };
  status?: 'delivered' | 'cancelled' | 'all';
};

export async function POST(_req: NextRequest) {
  // A partir de ahora no se permite eliminar pedidos del histórico
  return NextResponse.json(
    { ok: false, message: 'La eliminación de pedidos del histórico está deshabilitada' },
    { status: 405 }
  );
}
