// src/components/AdminCTA.tsx

'use client';

import Link from 'next/link';
import { PLAN } from '@/utils/plan';

export default function AdminCTA() {
  // En Starter NO mostramos nada
  if (PLAN === 'starter') return null;

  // En Medium/Premium sí se muestra
  return (
    <Link
      href="/admin"
      className="rounded-xl bg-gradient-to-r from-orange-500 to-green-600 px-4 py-2 text-white font-medium hover:opacity-90"
    >
      Panel
    </Link>
  );
}
