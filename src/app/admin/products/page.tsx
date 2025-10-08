// src/app/admin/products/page.tsx
// fuerza Node.js (no Edge) y evita prerender
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';



export default function AdminProductsLegacy() {
  redirect('/admin'); // usamos la nueva página única
  return null;
}
