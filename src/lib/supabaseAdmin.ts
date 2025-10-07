// src/lib/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js';

export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!; // ¡clave secreta (solo servidor)!

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
