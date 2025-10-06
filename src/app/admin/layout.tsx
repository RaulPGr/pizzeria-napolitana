"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import AdminTabs from "@/components/admin/AdminTabs";
import NewOrderSound from '@/components/NewOrderSound';


export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Panel de Administración</h1>
        <button
          onClick={handleSignOut}
          className="px-3 py-1 rounded border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50"
          disabled={signingOut}
        >
          {signingOut ? "Cerrando..." : "Cerrar sesión"}
        </button>
      </div>

      <AdminTabs />
      {children}
      <NewOrderSound />

    </div>
  );
}
