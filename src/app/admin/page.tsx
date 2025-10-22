// src/app/admin/page.tsx

// fuerza Node.js (no Edge) y evita prerender
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { headers } from 'next/headers';
import ProductsTable from '@/components/admin/ProductsTable';

// Obtiene la URL base de forma robusta (Vercel, local, etc.)
async function getBaseUrl() {
  // En Next 15, headers() puede ser asíncrono; si fuese síncrono, await no rompe.
  const h = await headers();

  // En Vercel vienen estos headers
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host = h.get('host');

  // Si tenemos host, construimos la base con él
  if (host) return `${proto}://${host}`;

  // Fallback: variable de entorno (por si algún proxy raro no pasa el host)
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}

export default async function AdminPage() {
  const baseUrl = await getBaseUrl();

  // Leemos la cookie de la request (para mantener sesión en el fetch SSR)
  const h = await headers();
  const cookie = h.get('cookie') ?? '';

  // Pedimos los datos al API interno sin cache
  // Usamos el endpoint admin (service role) para evitar problemas de RLS
  const res = await fetch(`${baseUrl}/api/admin/orders/products`, {
    cache: 'no-store',
    headers: { cookie },
  });

  // Si la respuesta no es OK, forzamos un error legible
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `Request to ${baseUrl}/api/admin/orders/products failed`);
  }

  const { products, categories, weekdays } = await res.json();

  return (
    <div className="space-y-6">
      {/* H1 lo pinta el layout; aquí solo subtítulo si quieres */}
      <h2 className="text-lg font-medium">Productos</h2>

      <ProductsTable
        initialProducts={products ?? []}
        categories={categories ?? []}
        initialWeekdays={weekdays ?? {}}
      />
    </div>
  );
}
