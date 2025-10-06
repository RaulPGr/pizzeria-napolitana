export type CartItem = {
  product_id: number | string;
  name: string;
  unit_price_cents: number;
  quantity: number;
  image?: string;
};

export function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("cart");
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]) {
  try {
    localStorage.setItem("cart", JSON.stringify(items));
    // Notificamos a otros componentes (badge, etc.)
    window.dispatchEvent(new CustomEvent("cart:updated", { detail: items }));
  } catch {}
}

export function addToCart(
  item: Omit<CartItem, "quantity"> & { quantity?: number }
) {
  const items = readCart();
  const qty = Math.max(1, item.quantity ?? 1);
  const idx = items.findIndex(
    (it) => String(it.product_id) === String(item.product_id)
  );
  if (idx >= 0) {
    items[idx].quantity += qty;
  } else {
    items.push({
      product_id: item.product_id,
      name: item.name,
      unit_price_cents: item.unit_price_cents,
      quantity: qty,
      image: (item as any).image,
    });
  }
  writeCart(items);
}

export function clearCart() {
  writeCart([]);
}
