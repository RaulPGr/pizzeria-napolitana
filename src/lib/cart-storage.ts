// src/lib/cart-storage.ts
"use client";

// Representa un topping/extra almacenado dentro del carrito del cliente.
export type CartOption = {
  optionId?: string;
  name: string;
  groupName?: string;
  price_delta?: number;
};

// Cada línea del carrito (producto base + opciones seleccionadas).
export type CartItem = {
  id: string | number;
  name: string;
  price: number; // precio final por unidad
  image?: string;
  qty: number;
  category_id?: number | null;
  options?: CartOption[];
  variantKey?: string | null;
  basePrice?: number;
  optionTotal?: number;
};

const KEY = "cart";

/** Normaliza cualquier forma antigua a nuestro shape actual */
function normalize(raw: any): CartItem | null {
  if (!raw) return null;

  const id = raw.id ?? raw.product_id;
  const name = raw.name ?? raw.nombre ?? raw.title;
  const price =
    raw.price !== undefined
      ? Number(raw.price)
      : raw.unit_price_cents !== undefined
      ? Number(raw.unit_price_cents) / 100
      : raw.precio !== undefined
      ? Number(raw.precio)
      : NaN;
  const image = raw.image ?? raw.imagen ?? raw.photo;
  const qty = Number(raw.qty ?? raw.quantity ?? 1);
  const category_id_raw = raw.category_id ?? raw.categoryId ?? null;
  const category_id =
    category_id_raw == null || category_id_raw === "" ? null : Number(category_id_raw);
  const optionsArray = Array.isArray(raw.options)
    ? raw.options.map((opt: any) => ({
        optionId: opt.optionId ?? opt.id ?? undefined,
        name: opt.name ?? "",
        groupName: opt.groupName ?? opt.group ?? undefined,
        price_delta: Number(opt.price_delta ?? opt.priceDelta ?? 0) || 0,
      }))
    : undefined;
  const variantKey = raw.variantKey ?? null;
  const basePrice = raw.basePrice != null ? Number(raw.basePrice) : undefined;
  const optionTotal = raw.optionTotal != null ? Number(raw.optionTotal) : undefined;

  if (id === undefined || !name || !isFinite(price)) return null;
  return {
    id,
    name,
    price,
    image,
    qty: Math.max(1, qty),
    category_id: Number.isFinite(category_id) ? category_id : null,
    options: optionsArray,
    variantKey: variantKey || null,
    basePrice,
    optionTotal,
  };
}

function read(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map(normalize).filter(Boolean) as CartItem[];
  } catch {
    return [];
  }
}

function write(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  // Notifica a TODO el mundo (misma pestaña y otras)
  window.dispatchEvent(new CustomEvent("cart_updated"));
}

export function getCart(): CartItem[] {
  return read();
}

export function getCount(): number {
  return read().reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
}

// Añade un producto al carrito teniendo en cuenta variantes (toppings seleccionados).
export function addItem(
  product: {
    id: any;
    name?: string;
    nombre?: string;
    price?: number;
    precio?: number;
    image?: string;
    imagen?: string;
    category_id?: number | null;
    categoryId?: number | null;
    options?: CartOption[];
    variantKey?: string;
    basePrice?: number;
    optionTotal?: number;
  },
  qty = 1
) {
  const items = read();
  const id = product.id;
  const name = (product.name ?? product.nombre) as string;
  const price = Number(product.price ?? product.precio ?? 0);
  const image = product.image ?? product.imagen;
  const category_id_raw = product.category_id ?? product.categoryId ?? null;
  const category_id = category_id_raw == null ? null : Number(category_id_raw);
  const options = Array.isArray(product.options)
    ? product.options.map((opt) => ({
        optionId: opt.optionId,
        name: opt.name,
        groupName: opt.groupName,
        price_delta: Number(opt.price_delta ?? 0) || 0,
      }))
    : undefined;
  const variantKey =
    product.variantKey ||
    (options && options.length > 0 ? [id, ...options.map((opt) => opt.optionId ?? opt.name)].join("|") : undefined);

  const idx = items.findIndex((it) => it.id === id && (it.variantKey || null) === (variantKey || null));
  if (idx >= 0) {
    items[idx].qty += qty;
    if ((items[idx].category_id == null || Number.isNaN(items[idx].category_id as any)) && category_id != null && Number.isFinite(category_id)) {
      items[idx].category_id = category_id;
    }
    if (!items[idx].options && options) {
      items[idx].options = options;
    }
  } else {
    items.push({
      id,
      name,
      price,
      image,
      qty: Math.max(1, qty),
      category_id: Number.isFinite(category_id) ? category_id : null,
      options,
      variantKey: variantKey || null,
      basePrice: product.basePrice != null ? Number(product.basePrice) : undefined,
      optionTotal: product.optionTotal != null ? Number(product.optionTotal) : undefined,
    });
  }
  write(items);
}

// Actualiza la cantidad de un ítem concreto.
export function setQty(id: any, qty: number, variantKey?: string) {
  const items = read()
    .map((it) =>
      it.id === id && (it.variantKey || null) === (variantKey || null)
        ? { ...it, qty: Math.max(0, qty) }
        : it
    )
    .filter((it) => it.qty > 0);
  write(items);
}

// Elimina un ítem del carrito.
export function removeItem(id: any, variantKey?: string) {
  const items = read().filter((it) => !(it.id === id && (it.variantKey || null) === (variantKey || null)));
  write(items);
}

export function clearCart() {
  write([]);
}

/** Suscripción sencilla a cambios del carrito (misma pestaña y storage) */
export function subscribe(onChange: (items: CartItem[]) => void) {
  const handler = () => onChange(read());
  const storageHandler = (e: StorageEvent) => {
    if (e.key === KEY) handler();
  };

  window.addEventListener("cart_updated", handler);
  window.addEventListener("storage", storageHandler);

  // push estado inicial
  handler();

  return () => {
    window.removeEventListener("cart_updated", handler);
    window.removeEventListener("storage", storageHandler);
  };
}
