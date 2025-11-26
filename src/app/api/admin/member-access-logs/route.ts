export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Valida slugs recibidos por query/cookie/subdominio para evitar valores raros.
function normalizeSlug(v: string | null | undefined): string {
  const s = (v || '').trim().toLowerCase();
  return s && /^[a-z0-9-_.]{1,120}$/.test(s) ? s : '';
}

// Busca el tenant actual en query (?tenant=), cookie o subdominio.
async function getTenantSlug(req?: Request): Promise<string> {
  let slug = '';
  try {
    if (req) {
      const u = new URL(req.url);
      slug = normalizeSlug(u.searchParams.get('tenant'));
    }
  } catch {}
  if (!slug) {
    try {
      const cookieStore = await cookies();
      slug = normalizeSlug(cookieStore.get('x-tenant-slug')?.value);
    } catch {}
  }
  if (!slug) {
    try {
      const hdrs = await headers();
      const host = (hdrs.get('host') || '').split(':')[0];
      const parts = host.split('.');
      if (parts.length >= 3) slug = normalizeSlug(parts[0]);
    } catch {}
  }
  return slug;
}

// Traducimos el slug a id real de negocio para operar en Supabase.
async function getBusinessId(slug: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('businesses')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as any)?.id ?? null;
}

// Devuelve el historial de accesos de miembros del negocio (últimas 50 entradas).
export async function GET(req: Request) {
  try {
    const slug = await getTenantSlug(req);
    if (!slug) return NextResponse.json({ ok: false, error: 'Missing tenant' }, { status: 400 });
    const bizId = await getBusinessId(slug);
    if (!bizId) return NextResponse.json({ ok: false, error: 'Business not found' }, { status: 404 });

    const { data, error } = await supabaseAdmin
      .from('business_member_access_logs')
      .select('user_id, accessed_at')
      .eq('business_id', bizId)
      .order('accessed_at', { ascending: false })
      .limit(50);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    // Cache local para no llamar a getUserById repetidamente.
    const emailCache = new Map<string, string | null>();
    const results: Array<{ userId: string; email: string | null; accessedAt: string | null }> = [];
    for (const row of data || []) {
      const userId = (row as any)?.user_id as string | undefined;
      if (!userId) continue;
      if (!emailCache.has(userId)) {
        try {
          const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
          emailCache.set(userId, userData.user?.email ?? null);
        } catch {
          emailCache.set(userId, null);
        }
      }
      results.push({
        userId,
        email: emailCache.get(userId) ?? null,
        accessedAt: (row as any)?.accessed_at || null,
      });
    }

    return NextResponse.json({ ok: true, logs: results });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Error' }, { status: 500 });
  }
}
