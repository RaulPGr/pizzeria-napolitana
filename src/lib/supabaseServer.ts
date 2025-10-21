// src/lib/supabaseServer.ts
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Crea un cliente de Supabase para rutas/acciones de servidor
 * usando las cookies de Next (SSR).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const tenant = cookieStore.get('x-tenant-slug')?.value || '';

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: tenant ? { 'x-tenant-slug': tenant } : {},
      },
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );

  return supabase;
}
