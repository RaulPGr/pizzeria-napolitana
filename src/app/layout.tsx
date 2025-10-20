// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { CartProvider } from "@/context/CartContext";
import Navbar from "@/components/Navbar"; // Se mantiene tu Navbar

export const metadata: Metadata = {
  title: "Comida para llevar",
  description: "Pedidos online",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-slate-50">
        <CartProvider>
          {/* Header fijo en todas las páginas */}
          <div className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur border-b border-brand-crust">
            <Navbar />
          </div>

          {/* Compensación de la altura del header fijo (ajusta si tu Navbar es más alto/bajo) */}
          <main className="min-h-screen pt-[64px] md:pt-[72px]">
            {children}
          </main>
        </CartProvider>
      </body>
    </html>
  );
}
