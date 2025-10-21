import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Lee el slug de cookie (seteada por middleware) y resuelve el negocio
export async function getTenant() {
  const cookieStore = await cookies();
  const slug = cookieStore.get('x-tenant-slug')?.value || '';
  if (!slug) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supa = createClient(url, service, { auth: { persistSession: false } });

  const { data, error } = await supa
    .from('businesses')
    .select('id, slug, name, logo_url, hero_url, brand_primary, brand_secondary, opening_hours, phone, whatsapp, email, address_line, city, postal_code, social')
    .eq('slug', slug)
    .maybeSingle();

  if (error) return null;
  return data;
}

