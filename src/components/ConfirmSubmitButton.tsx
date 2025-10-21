"use client";

import { useSubmitOnce } from "@/hooks/useSubmitOnce";

type Props = {
  onClick: () => Promise<void> | void; // tu confirmarPedido actual
  className?: string;
  idleText?: string;
  busyText?: string;
  disabled?: boolean;
  title?: string;
};

export default function ConfirmSubmitButton({
  onClick,
  className = "bg-green-600 hover:bg-green-700 text-white",
  idleText = "Confirmar pedido",
  busyText = "Enviando…",
  disabled = false,
  title,
}: Props) {
  const { busy, run } = useSubmitOnce();

  return (
    <button
      type="button"
      onClick={() => run(onClick)}
      disabled={busy || disabled}
      title={title}
      className={`px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {busy ? busyText : idleText}
    </button>
  );
}
