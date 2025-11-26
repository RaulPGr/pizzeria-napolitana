"use client";

import { useMemo, useState } from "react";

type OptionGroup = {
  id: string;
  name: string;
  description?: string | null;
  selection_type: "single" | "multiple";
  min_select?: number | null;
  max_select?: number | null;
  is_required?: boolean;
  options: Array<{
    id: string;
    name: string;
    price_delta: number;
  }>;
};

type Product = {
  id: number | string;
  name: string;
  price: number;
  category_id?: number | null;
  option_groups: OptionGroup[];
  image_url?: string | null;
};

type CartOptionSelection = {
  optionId: string;
  name: string;
  groupId: string;
  groupName: string;
  price_delta: number;
};

type Props = {
  product: Product;
  onConfirm: (selection: {
    options: CartOptionSelection[];
    totalPrice: number;
    basePrice: number;
    optionTotal: number;
    variantKey: string;
  }) => void;
  onClose: () => void;
};

function formatPrice(n: number) {
  try {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
  } catch {
    return `${n.toFixed(2)} EUR`;
  }
}

// Modal que permite elegir toppings/extras antes de añadir el producto al carrito.
export default function ProductOptionsModal({ product, onConfirm, onClose }: Props) {
  const basePrice = Number(product.price || 0);
  const [selected, setSelected] = useState<Record<string, Set<string>>>(() => {
    const initial: Record<string, Set<string>> = {};
    for (const group of product.option_groups) {
      if (group.selection_type === "single") {
        const min = group.min_select ?? (group.is_required !== false ? 1 : 0);
        if (min > 0 && group.options.length > 0) {
          initial[group.id] = new Set([group.options[0].id]);
        } else {
          initial[group.id] = new Set();
        }
      } else {
        initial[group.id] = new Set();
      }
    }
    return initial;
  });

  function toggle(group: OptionGroup, optionId: string) {
    setSelected((prev) => {
      const current = new Set(prev[group.id] || []);
      const selectionType = group.selection_type || "single";
      const max = group.max_select ?? (selectionType === "single" ? 1 : null);
      if (selectionType === "single") {
        if (current.has(optionId)) {
          current.clear();
        } else {
          current.clear();
          current.add(optionId);
        }
      } else {
        if (current.has(optionId)) {
          current.delete(optionId);
        } else {
          if (max && current.size >= max) return prev;
          current.add(optionId);
        }
      }
      return { ...prev, [group.id]: current };
    });
  }

  // Normalizamos límites y requisitos para simplificar la validación.
  const normalizedGroups = useMemo(() => {
    return product.option_groups.map((group) => {
      const selectionType = group.selection_type || "single";
      const min = group.min_select ?? (group.is_required !== false && selectionType === "single" ? 1 : 0);
      const max = group.max_select ?? (selectionType === "single" ? 1 : null);
      return {
        ...group,
        min,
        max,
      };
    });
  }, [product.option_groups]);

  const validation = useMemo(() => {
    const errors: Record<string, string> = {};
    for (const group of normalizedGroups) {
      const picks = selected[group.id] || new Set();
      const count = picks.size;
      if (group.min && count < group.min) {
        errors[group.id] = `Selecciona al menos ${group.min}`;
      }
      if (group.max && count > group.max) {
        errors[group.id] = `Máximo ${group.max}`;
      }
    }
    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }, [normalizedGroups, selected]);

  // Lista plana de las opciones seleccionadas, útil para calcular total y renderizar.
  const selectionList = useMemo(() => {
    const list: CartOptionSelection[] = [];
    for (const group of normalizedGroups) {
      const picks = selected[group.id] || new Set();
      for (const optionId of picks) {
        const option = group.options.find((opt) => opt.id === optionId);
        if (!option) continue;
        list.push({
          optionId,
          name: option.name,
          groupId: group.id,
          groupName: group.name,
          price_delta: Number(option.price_delta || 0),
        });
      }
    }
    list.sort((a, b) => (a.groupName || "").localeCompare(b.groupName || "") || a.name.localeCompare(b.name));
    return list;
  }, [normalizedGroups, selected]);

  const optionTotal = selectionList.reduce((sum, opt) => sum + opt.price_delta, 0);
  const finalPrice = basePrice + optionTotal;
  const variantKey =
    selectionList.length > 0 ? [product.id, ...selectionList.map((opt) => opt.optionId)].join("|") : String(product.id);

  function handleConfirm() {
    if (!validation.valid) return;
    onConfirm({
      options: selectionList,
      totalPrice: finalPrice,
      basePrice,
      optionTotal,
      variantKey,
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-3 py-6">
      <div className="max-h-full w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start gap-4 border-b px-5 py-4">
          {product.image_url && (
            <img src={product.image_url} alt={product.name} className="hidden h-20 w-20 rounded object-cover sm:block" />
          )}
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{product.name}</h2>
            <p className="text-sm text-slate-500">Precio base: {formatPrice(basePrice)}</p>
          </div>
          <button onClick={onClose} className="rounded-full border px-3 py-1 text-sm text-slate-500 hover:bg-slate-50" type="button">
            Cerrar
          </button>
        </div>
        <div className="max-h-[65vh] space-y-5 overflow-y-auto px-5 py-4">
          {normalizedGroups.map((group) => {
            const picks = selected[group.id] || new Set();
            const error = validation.errors[group.id];
            const isSingle = group.selection_type === "single";
            return (
              <div key={group.id} className="rounded border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold">{group.name}</p>
                    {group.description && <p className="text-sm text-slate-500">{group.description}</p>}
                  </div>
                  <span className="text-xs text-slate-500">
                    {isSingle ? "Una selección" : "Selecciona varias"}{" "}
                    {group.is_required !== false || (group.min ?? 0) > 0 ? "· Obligatorio" : "· Opcional"}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {group.options.map((opt) => {
                    const checked = picks.has(opt.id);
                    const inputId = `${group.id}-${opt.id}`;
                    return (
                      <label
                        key={opt.id}
                        htmlFor={inputId}
                        className={`flex cursor-pointer items-center justify-between rounded border px-3 py-2 text-sm ${
                          checked ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isSingle ? (
                            <input
                              type="radio"
                              id={inputId}
                              name={group.id}
                              checked={checked}
                              onChange={() => toggle(group, opt.id)}
                              className="h-4 w-4"
                            />
                          ) : (
                            <input
                              type="checkbox"
                              id={inputId}
                              checked={checked}
                              onChange={() => toggle(group, opt.id)}
                              className="h-4 w-4"
                            />
                          )}
                          <span>{opt.name}</span>
                        </div>
                        <span className="text-xs font-semibold text-slate-600">
                          {opt.price_delta > 0 ? `+${formatPrice(opt.price_delta)}` : opt.price_delta < 0 ? `-${formatPrice(Math.abs(opt.price_delta))}` : "Sin recargo"}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
          <div className="text-sm text-slate-600">
            Total:<span className="ml-2 text-lg font-semibold text-emerald-700">{formatPrice(finalPrice)}</span>
            {optionTotal > 0 && (
              <span className="ml-2 text-xs text-slate-500">
                (incluye {formatPrice(optionTotal)} en toppings)
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded border px-4 py-2 text-sm" >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!validation.valid}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Añadir al carrito
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
