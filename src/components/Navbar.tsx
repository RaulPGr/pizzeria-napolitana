// src/components/Navbar.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCount, subscribe } from "@/lib/cart-storage";
import { useSubscriptionPlan } from "@/context/SubscriptionPlanContext";
import { useOrdersEnabled } from "@/context/OrdersEnabledContext";
import { subscriptionAllowsOrders, subscriptionAllowsReservations } from "@/lib/subscription";
// Admin entry removed from navbar

export default function NavBar() {
  const plan = useSubscriptionPlan();
  const ordersEnabled = useOrdersEnabled();
  const allowOrdering = subscriptionAllowsOrders(plan) && ordersEnabled;
  const allowReservations = subscriptionAllowsReservations(plan);
  const [count, setCount] = useState(0);
  const [reservationsEnabled, setReservationsEnabled] = useState(false);

  useEffect(() => {
    if (!allowOrdering) {
      setCount(0);
      return;
    }
    const unsub = subscribe(() => setCount(getCount()));
    return () => unsub();
  }, [allowOrdering]);

  useEffect(() => {
    let active = true;
    const resolveTenant = () => {
      if (typeof window === "undefined") return "";
      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get("tenant")?.trim();
      if (fromQuery) return fromQuery;
      const cookie = document.cookie.split(";").find((c) => c.trim().startsWith("x-tenant-slug="));
      if (cookie) return cookie.split("=")[1];
      const host = window.location.hostname;
      const parts = host.split(".");
      if (parts.length >= 3) return parts[0];
      return "";
    };
    const load = async () => {
      try {
        const slug = resolveTenant();
        const url = slug ? `/api/settings/home?tenant=${encodeURIComponent(slug)}` : "/api/settings/home";
        const resp = await fetch(url, { cache: "no-store" });
        const j = await resp.json();
        if (!active) return;
        setReservationsEnabled(Boolean(j?.data?.reservations?.enabled));
      } catch {
        if (active) setReservationsEnabled(false);
      }
    };
    if (allowReservations) load();
    else setReservationsEnabled(false);
    return () => {
      active = false;
    };
  }, [allowReservations]);

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
          {allowReservations && reservationsEnabled && <Item href="/reservas">Reserva tu mesa</Item>}
          {/* Admin link intentionally removed */}
        </div>
        {allowOrdering && (
          <div className="relative">
            <Link href="/cart" className="text-white hover:text-gray-300">
              <span className="inline-flex items-center gap-1.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path d="M3 5h2l2.4 10.2a1 1 0 0 0 .98.8H17a1 1 0 0 0 .96-.72L21 8H7" />
                  <circle cx="9" cy="20" r="1.5" />
                  <circle cx="17" cy="20" r="1.5" />
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
        )}
      </nav>
    </header>
  );
}
