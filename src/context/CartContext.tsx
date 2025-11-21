"use client";

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  type ReactNode,
} from "react";

export type CartItem = {
  id: string | number;
  name: string;
  price: number;
  image?: string;
  qty: number;
  category_id?: number | null;
};

type CartState = { items: CartItem[] };

type CartAction =
  | { type: "ADD"; payload: Omit<CartItem, "qty">; qty?: number }
  | { type: "INC"; id: CartItem["id"] }
  | { type: "DEC"; id: CartItem["id"] }
  | { type: "REMOVE"; id: CartItem["id"] }
  | { type: "CLEAR" };

const STORAGE_KEY = "cart";

const CartContext = createContext<{
  state: CartState;
  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void;
  inc: (id: CartItem["id"]) => void;
  dec: (id: CartItem["id"]) => void;
  remove: (id: CartItem["id"]) => void;
  clear: () => void;
} | null>(null);

const initial: CartState = { items: [] };

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD": {
      const { payload, qty = 1 } = action;
      const idx = state.items.findIndex((it) => it.id === payload.id);
      if (idx >= 0) {
        const next = [...state.items];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return { items: next };
      }
      return { items: [...state.items, { ...payload, qty }] };
    }
    case "INC":
      return {
        items: state.items.map((it) =>
          it.id === action.id ? { ...it, qty: it.qty + 1 } : it
        ),
      };
    case "DEC":
      return {
        items: state.items
          .map((it) =>
            it.id === action.id ? { ...it, qty: Math.max(it.qty - 1, 0) } : it
          )
          .filter((it) => it.qty > 0),
      };
    case "REMOVE":
      return { items: state.items.filter((it) => it.id !== action.id) };
    case "CLEAR":
      return initial;
    default:
      return state;
  }
}

function loadFromStorage(): CartState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : initial;
  } catch {
    return initial;
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    reducer,
    initial,
    () => (typeof window === "undefined" ? initial : loadFromStorage())
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  const addItem = (item: Omit<CartItem, "qty">, qty = 1) =>
    dispatch({ type: "ADD", payload: item, qty });
  const inc = (id: CartItem["id"]) => dispatch({ type: "INC", id });
  const dec = (id: CartItem["id"]) => dispatch({ type: "DEC", id });
  const remove = (id: CartItem["id"]) => dispatch({ type: "REMOVE", id });
  const clear = () => dispatch({ type: "CLEAR" });

  return (
    <CartContext.Provider value={{ state, addItem, inc, dec, remove, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
