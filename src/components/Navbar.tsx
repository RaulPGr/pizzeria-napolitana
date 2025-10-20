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
            Carrito
          </Link>
          {count > 0 && (
            <span className="absolute -right-3 -top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-green-500 px-1 text-xs font-bold text-white">
              {count}
            </span>
          )}
        </div>
      </nav>
    </header>
  );
}
