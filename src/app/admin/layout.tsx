// src/app/admin/layout.tsx
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
// ⬇️ usa import relativo si no tienes '@' configurado
import AdminTabs from '../../components/admin/AdminTabs';
import LogoutButton from '../../components/admin/LogoutButton';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const h = await headers();
  const cookie = h.get('cookie') || '';
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  const res = await fetch(`${site}/api/whoami`, {
    headers: { cookie },
    cache: 'no-store',
  });
  const who = (await res.json()) as { ok: boolean; email: string | null };

  if (!who.ok) redirect('/login');

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Panel de Administración</h1>
        <LogoutButton />
      </div>

      <AdminTabs />

      {children}
    </div>
  );
}
