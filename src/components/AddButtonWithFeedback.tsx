"use client";

import { useState } from "react";

type Props = {
  onAdd: () => Promise<void> | void; // tu handler actual que añade al carrito
  disabled?: boolean;
  className?: string;
  label?: string;       // por defecto: "Añadir"
  addedLabel?: string;  // por defecto: "Añadido"
};

export default function AddButtonWithFeedback({
  onAdd,
  disabled,
  className = "",
  label = "Añadir",
  addedLabel = "Añadido",
}: Props) {
  const [busy, setBusy] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const handleClick = async () => {
    if (busy || disabled) return;
    try {
      setBusy(true);
      await onAdd();
      setJustAdded(true);
      // mostramos el "Añadido" un instante, y luego volvemos al estado normal
      setTimeout(() => setJustAdded(false), 800);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || busy}
      className={`px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition ${className}`}
      aria-live="polite"
    >
      {busy ? (
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-full border-2 border-white/60 border-t-transparent animate-spin" />
          {label}
        </span>
      ) : justAdded ? (
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-full bg-green-400" />
          {addedLabel} ✓
        </span>
      ) : (
        label
      )}
    </button>
  );
}
