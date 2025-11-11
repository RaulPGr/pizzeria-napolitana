import { cookies, headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

function normalizeSlug(value: string | null | undefined) {
  const slug = (value || '').trim().toLowerCase();
  return slug && /^[a-z0-9-_.]{1,120}$/.test(slug) ? slug : '';
}

// Lee el slug de cookie (seteada por middleware) y resuelve el negocio
type TenantOptions = { path?: string };

export async function getTenant(explicit?: string | null, options?: TenantOptions) {
  const cookieStore = await cookies();
  let slug = normalizeSlug(explicit) || normalizeSlug(cookieStore.get('x-tenant-slug')?.value);

  if (!slug) {
    try {
      const hdrs = await headers();
      const host = (hdrs.get('host') || '').split(':')[0]?.toLowerCase() || '';
      const parts = host.split('.');
      if (parts.length >= 3) {
        let candidate = parts[0];
        if (candidate === 'www' && parts.length >= 4) {
          candidate = parts[1];
        }
        slug = normalizeSlug(candidate);
      }
    } catch {
      // ignore header errors
    }
  }

  if (!slug && options?.path) {
    try {
      const segments = options.path.split('/').filter(Boolean);
      if (segments.length > 0) {
        const candidate = segments[0];
        slug = normalizeSlug(candidate);
      }
    } catch {}
  }

  if (!slug) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supa = createClient(url, service, { auth: { persistSession: false } });

  const { data, error } = await supa
    .from('businesses')
    .select('id, slug, name, logo_url, hero_url, brand_primary, brand_secondary, opening_hours, ordering_hours, phone, whatsapp, email, address_line, city, postal_code, social')
    .eq('slug', slug)
    .maybeSingle();

  if (error) return null;
  return data;
}
