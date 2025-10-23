"use client";

import { useEffect } from "react";

export default function AuthHashRedirect() {
  useEffect(() => {
    try {
      const { location } = window;
      const hasCode = location.search.includes('code=');
      const hash = location.hash || '';
      const hasTokens = hash.includes('access_token=') || hash.includes('refresh_token=');
      const hasError = hash.includes('error=');
      const onReset = location.pathname.startsWith('/auth/reset');
      if (!onReset && (hasCode || hasTokens || hasError)) {
        const target = `/auth/reset${location.search}${location.hash}`;
        // Usa replace para no dejar historial intermedio
        location.replace(target);
      }
    } catch {}
  }, []);
  return null;
}

