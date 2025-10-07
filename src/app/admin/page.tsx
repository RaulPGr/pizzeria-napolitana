// src/app/admin/page.tsx
import { headers } from 'next/headers';
import ProductsTable from '@/components/admin/ProductsTable';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  // Leemos la cookie de la request (Next 15: headers() -> Promise<ReadonlyHeaders>)
  const hdrs = await headers();
  const cookie = hdrs.get('cookie') ?? '';

  // SSR sin caché, pasando la cookie para respetar la sesión
  const res = await fetch(`${site}/api/products`, {
    cache: 'no-store',
    headers: { cookie },
  });

  const { products, categories } = await res.json();

  return (
    <div className="space-y-6">
      {/* H1 lo pinta el layout; aquí solo subtítulo */}
      <h2 className="text-lg font-medium">Productos</h2>

      <ProductsTable
        initialProducts={products ?? []}
        categories={categories ?? []}
      />
    </div>
  );
}
