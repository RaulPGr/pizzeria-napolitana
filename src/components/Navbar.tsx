// src/components/Navbar.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCount, subscribe } from "@/lib/cart-storage";
// Admin entry removed from navbar

export default function NavBar() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const unsub = subscribe(() => setCount(getCount()));
    return () => unsub();
  }, []);

  const Item = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <Link href={href} className="text-white hover:text-gray-300">
      {children}
    </Link>
  );

  return (
    <header className="bg-slate-900 text-white border-b border-brand-crust">
      <nav className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Item href="/">Inicio</Item>
          <Item href="/menu">Menú</Item>
          {/* Admin link intentionally removed */}
        </div>
        <div className="relative">
          <Link href="/cart" className="text-white hover:text-gray-300">
            <span className="inline-flex items-center gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M7.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm9 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM4 4.5h1.382a1.5 1.5 0 0 1 1.453 1.12l.262 1.048m0 0 .903 3.614m2.076 8.218h7.557a1.5 1.5 0 0 0 1.462-1.131l2.043-8.172A1.5 1.5 0 0 0 20.27 8.25H8.5m0 0L7.097 2.88A1.5 1.5 0 0 0 5.618 1.75H3.75"/>
              </svg>
              <span>Carrito</span>
            </span>
          </Link>
          {count > 0 && (
            <span className="absolute -right-3 -top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-xs font-bold text-white">
              {count}
            </span>
          )}
        </div>
      </nav>
    </header>
  );
}
