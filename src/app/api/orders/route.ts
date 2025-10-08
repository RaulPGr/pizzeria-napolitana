// src/app/api/orders/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin'; // ajusta la ruta si en tu proyecto es distinta

const noStore = { headers: { 'Cache-Control': 'no-store' } };

/**
 * GET /api/orders
 * Devuelve el listado de pedidos (si lo usas en el admin).
 * No crea ni modifica pedidos (Starter/Medium).
 */
export async function GET(req: Request) {
  try {
    const db = supabaseAdmin(); // ← IMPORTANTE: invocar la factory para obtener el cliente

    const url = new URL(req.url);
    const limit = Number(url.searchParams.get('limit') ?? '50');
    const from  = Number(url.searchParams.get('from')  ?? '0');

    const { data, error, count } = await db
      .from('orders')
      .select(
        `
          id,
          status,
          total_cents,
          customer_name,
          customer_phone,
          created_at,
          order_items (
            name,
            quantity,
            unit_price_cents
          )
        `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500, ...noStore }
      );
    }

    return NextResponse.json(
      { ok: true, orders: data ?? [], count: count ?? 0 },
      noStore
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? 'Unexpected error' },
      { status: 500, ...noStore }
    );
  }
}

/**
 * Métodos de escritura deshabilitados en Starter/Medium
 * (evita romper el build y asegura que no se creen pedidos).
 */
function methodNotAllowed() {
  return NextResponse.json(
    { ok: false, error: 'Pedidos deshabilitados en este plan' },
    { status: 405, ...noStore }
  );
}

export async function POST()   { return methodNotAllowed(); }
export async function PUT()    { return methodNotAllowed(); }
export async function PATCH()  { return methodNotAllowed(); }
export async function DELETE() { return methodNotAllowed(); }
