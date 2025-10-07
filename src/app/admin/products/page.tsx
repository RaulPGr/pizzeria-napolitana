// src/app/admin/products/page.tsx
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function AdminProductsLegacy() {
  redirect('/admin'); // usamos la nueva página única
  return null;
}
