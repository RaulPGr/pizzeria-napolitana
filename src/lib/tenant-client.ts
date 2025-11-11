"use client";

const RESERVED_SEGMENTS = new Set([
  "",
  "admin",
  "cart",
  "menu",
  "reservas",
  "login",
  "logout",
  "settings",
  "api",
]);

export function resolveTenantSlugClient(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("tenant")?.trim();
  if (fromQuery) return fromQuery;
  const cookieMatch = document.cookie.match(/(?:^|;\s*)x-tenant-slug=([^;]+)/);
  if (cookieMatch) return decodeURIComponent(cookieMatch[1]);
  const host = window.location.hostname.toLowerCase();
  const parts = host.split(".");
  if (parts.length >= 3) {
    const first = parts[0] === "www" && parts.length >= 4 ? parts[1] : parts[0];
    return first;
  }
  const pathSegments = window.location.pathname.split("/").filter(Boolean);
  if (pathSegments.length > 0) {
    const candidate = pathSegments[0].toLowerCase();
    if (!RESERVED_SEGMENTS.has(candidate)) {
      return candidate;
    }
  }
  return "";
}

export function persistTenantSlugClient(slug: string) {
  if (typeof document === "undefined" || !slug) return;
  document.cookie = `x-tenant-slug=${encodeURIComponent(slug)}; path=/; max-age=${60 * 60 * 24 * 30}`;
}
