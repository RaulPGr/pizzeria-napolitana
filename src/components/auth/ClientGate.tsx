'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ClientGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch('/api/whoami', { cache: 'no-store' });
        const data = await res.json();
        if (!alive) return;

        if (!data.ok) {
          router.replace('/login');
        } else {
          setReady(true);
        }
      } catch {
        router.replace('/login');
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  if (!ready) return null; // (puedes poner un loader si quieres)
  return <>{children}</>;
}
