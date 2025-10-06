'use client';

import { useEffect, useState } from 'react';

const LS_KEY = 'cart';

function getCountFromLS(): number {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items)
      ? items.reduce((s: number, it: any) => s + (Number(it?.qty) || 0), 0)
      : 0;
  } catch {
    return 0;
  }
}

export default function CartButton() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(getCountFromLS());

    const onUpdated = (e: Event) => {
      // @ts-ignore
      const c = e?.detail?.count as number | undefined;
      setCount(typeof c === 'number' ? c : getCountFromLS());
    };
    window.addEventListener('cart:updated', onUpdated as EventListener);

    const onStorage = (ev: StorageEvent) => {
      if (ev.key === LS_KEY) setCount(getCountFromLS());
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('cart:updated', onUpdated as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return (
    <a
      href="/cart"
      className="relative inline-flex items-center gap-2 rounded bg-slate-800 px-3 py-1 text-white hover:bg-slate-700"
    >
      <span aria-hidden>🛒</span>
      <span>Carrito</span>
      {count > 0 && (
        <span className="ml-1 rounded-full bg-green-600 px-2 text-xs font-semibold">
          {count}
        </span>
      )}
    </a>
  );
}
