"use client";

import { useEffect } from "react";

export default function DayTabsClientAdjust() {
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (!window.location.pathname.startsWith("/menu")) return;
      const url = new URL("/api/products", window.location.origin);
      fetch(String(url), { cache: "no-store", credentials: "same-origin" })
        .then((r) => r.json())
        .then((j) => {
          const days: number[] = Array.isArray(j?.available_days)
            ? (j.available_days as number[])
            : [];
          if (!Array.isArray(days) || days.length === 0) return;
          const as = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/menu?day="]'));
          as.forEach((a) => {
            try {
              const u = new URL(a.getAttribute("href") || "", window.location.origin);
              const d = Number(u.searchParams.get("day"));
              if (!Number.isFinite(d)) return;
              // Ocultamos "Todos los días" (0) y los no incluidos en available_days
              if (d === 0 || !days.includes(d)) {
                a.style.display = "none";
              }
            } catch {}
          });
        })
        .catch(() => {});
    } catch {}
  }, []);
  return null;
}

