'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function ThanksInner() {
  const params = useSearchParams();
  const router = useRouter();
  const sid = params.get('sid') ?? '';

  useEffect(() => {
    if (!sid) return;

    let attempts = 0;
    const poll = setInterval(async () => {
      attempts += 1;
      try {
        // 1) Resolver normal (si existe backend de Stripe)
        const r = await fetch(
          `/api/stripe/resolve?sid=${encodeURIComponent(sid)}`,
          { cache: 'no-store' }
        ).catch(() => null);

        if (r?.ok) {
          const j = await r.json();
          if (j.found && j.order_id) {
            clearInterval(poll);
            router.replace(`/order/${j.order_id}?paid=1`);
            return;
          }
        }

        // 2) Plan B (sync) tras varios intentos
        if (attempts >= 5) {
          const s = await fetch(
            `/api/stripe/sync?sid=${encodeURIComponent(sid)}`,
            { cache: 'no-store' }
          ).catch(() => null);

          if (s?.ok) {
            const js = await s.json();
            if ((js.created || js.found) && js.order_id) {
              clearInterval(poll);
              router.replace(`/order/${js.order_id}?paid=1`);
              return;
            }
          }
        }
      } catch {
        // ignoramos y seguimos
      }
    }, 1200);

    return () => clearInterval(poll);
  }, [sid, router]);

  return (
    <div className="p-6 text-center">
      <h1 className="text-2xl font-semibold mb-2">¡Gracias!</h1>
      <p>Estamos confirmando tu pago…</p>
    </div>
  );
}

export default function ThanksPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-center">
          <h1 className="text-2xl font-semibold mb-2">¡Gracias!</h1>
          <p>Procesando…</p>
        </div>
      }
    >
      <ThanksInner />
    </Suspense>
  );
}
