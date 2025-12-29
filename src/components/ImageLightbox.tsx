"use client";

import React from "react";

/**
 * Cliente ligero que escucha clicks en elementos con data-fullimage
 * y abre un modal de previsualización grande. No altera la lógica
 * del listado; sólo ofrece la capa visual.
 */
export default function ImageLightbox() {
  const [openImage, setOpenImage] = React.useState<{ src: string; alt?: string } | null>(null);

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const btn = target.closest<HTMLElement>("[data-fullimage]");
      if (!btn) return;
      const src = btn.dataset.fullimage;
      const alt = btn.dataset.alt || "";
      if (!src) return;
      e.preventDefault();
      setOpenImage({ src, alt });
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenImage(null);
    }
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  if (!openImage) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3 py-6 md:px-4">
      <div className="relative flex max-h-full w-full max-w-4xl items-center justify-center overflow-hidden rounded-xl bg-white shadow-2xl">
        <button
          type="button"
          className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-sm font-semibold text-white hover:bg-black/80"
          onClick={() => setOpenImage(null)}
        >
          Cerrar
        </button>
        <img
          src={openImage.src}
          alt={openImage.alt || "Imagen del producto"}
          className="max-h-[calc(100vh-120px)] w-full object-contain"
          loading="lazy"
        />
      </div>
    </div>
  );
}
