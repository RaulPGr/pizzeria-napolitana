"use client";

import { useState } from "react";
import AddToCartButton from "@/components/AddToCartButton";
import ProductOptionsModal from "@/components/ProductOptionsModal";
import { addItem } from "@/lib/cart-storage";

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
  image_url?: string | null;
  category_id?: number | null;
  option_groups?: OptionGroup[];
};

type Props = {
  product: Product;
  disabled?: boolean;
  disabledLabel?: string;
};

export default function AddToCartWithOptions({ product, disabled, disabledLabel }: Props) {
  const hasOptions = Array.isArray(product.option_groups) && product.option_groups.length > 0;
  const [open, setOpen] = useState(false);

  if (!hasOptions) {
    return (
      <AddToCartButton
        product={{
          id: product.id,
          name: product.name,
          price: product.price,
          image_url: product.image_url || undefined,
          category_id: product.category_id ?? null,
        }}
        disabled={disabled}
        disabledLabel={disabledLabel}
      />
    );
  }

  function handleConfirm(payload: { options: any[]; totalPrice: number; basePrice: number; optionTotal: number; variantKey: string }) {
    addItem(
      {
        id: product.id,
        name: product.name,
        price: payload.totalPrice,
        image: product.image_url || undefined,
        category_id: product.category_id ?? null,
        options: payload.options,
        variantKey: payload.variantKey,
        basePrice: payload.basePrice,
        optionTotal: payload.optionTotal,
      },
      1
    );
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className={`mt-2 w-full rounded border px-3 py-1 text-sm ${
          disabled ? "cursor-not-allowed opacity-50" : "bg-emerald-600 text-white hover:bg-emerald-700"
        }`}
      >
        Personalizar y añadir
      </button>
      {open && (
        <ProductOptionsModal
          product={{
            id: product.id,
            name: product.name,
            price: product.price,
            category_id: product.category_id ?? null,
            option_groups: product.option_groups || [],
            image_url: product.image_url,
          }}
          onClose={() => setOpen(false)}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
}
