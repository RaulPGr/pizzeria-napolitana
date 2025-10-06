// /src/lib/cartEvents.ts
export function emitCartUpdated(): void {
  try {
    window.dispatchEvent(new Event("cart_updated"));
  } catch {
    // no-op en SSR/errores
  }
}

/** Opcional: un wrapper para guardar y notificar en una sola llamada */
export function saveCartAndNotify(cart: any): void {
  try {
    localStorage.setItem("cart", JSON.stringify(cart));
  } finally {
    emitCartUpdated();
  }
}
