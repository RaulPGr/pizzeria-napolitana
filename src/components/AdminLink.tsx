// src/components/AdminLink.tsx
'use client';

import Link from 'next/link';

const PLAN = process.env.NEXT_PUBLIC_PLAN;

export default function AdminLink() {
  // En starter no mostramos el acceso al panel
  if (PLAN === 'starter') return null;

  // En medium/premium mostramos el enlace
  return (
    <Link href="/admin" className="px-3 py-2 rounded hover:opacity-80">
      Admin
    </Link>
  );
}
