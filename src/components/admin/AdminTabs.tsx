'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminTabs() {
  const pathname = usePathname();
  const tabs = [{ href: '/admin', label: 'Productos' }];

  return (
    <div className="mb-6 border-b border-brand-crust">
      <nav className="-mb-px flex gap-6">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={[
                'pb-3 text-sm',
                active
                  ? 'border-b-2 border-emerald-600 font-medium text-emerald-700'
                  : 'text-gray-600 hover:text-gray-800'
              ].join(' ')}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
