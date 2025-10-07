// src/app/admin/page.tsx
import { headers } from 'next/headers';
import ProductsTable from '@/components/admin/ProductsTable';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  // Pasamos la cookie para que el API responda con tu sesión (sin cache)
  const res = await fetch(`${site}/api/products`, {
    cache: 'no-store',
    headers: { cookie: (headers().get('cookie') ?? '') },
  });

  const { products, categories } = await res.json();

  return (
    <div className="space-y-6">
      {/* H1 ya lo pinta el layout. Aquí solo subtítulo */}
      <h2 className="text-lg font-medium">Productos</h2>

      <ProductsTable initialProducts={products ?? []} categories={categories ?? []} />
    </div>
  );
}
