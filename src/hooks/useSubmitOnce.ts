"use client";

import { useCallback, useState } from "react";

export function useSubmitOnce() {
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (fn: () => Promise<void> | void) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      // margen de seguridad por si el server responde ultra rápido
      setTimeout(() => setBusy(false), 600);
    }
  }, [busy]);

  return { busy, run };
}
