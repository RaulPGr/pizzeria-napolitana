export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const MEMBERSHIP_ROLES = ['owner', 'manager', 'staff'] as const;
type MemberRole = (typeof MEMBERSHIP_ROLES)[number];

function normalizeSlug(v: string | null | undefined): string {
  const s = (v || '').trim().toLowerCase();
  return s && /^[a-z0-9-_.]{1,120}$/.test(s) ? s : '';
}

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

async function getBusinessId(slug: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('businesses')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as any)?.id ?? null;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

function sanitizeRole(role: string | null | undefined): MemberRole {
  const val = String(role || '').toLowerCase();
  return MEMBERSHIP_ROLES.includes(val as MemberRole) ? (val as MemberRole) : 'staff';
}

function randomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@$%';
  let out = '';
  for (let i = 0; i < 12; i += 1) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const slug = await getTenantSlug(req);
    if (!slug) return NextResponse.json({ ok: false, error: 'Missing tenant' }, { status: 400 });

    const bizId = await getBusinessId(slug);
    if (!bizId) return NextResponse.json({ ok: false, error: 'Business not found' }, { status: 404 });

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
    }

    const email = normalizeEmail(String(body?.email || ''));
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: 'Email invalido' }, { status: 400 });
    }
    const role = sanitizeRole(body?.role);

    const requestedPassword = String(body?.password || '').trim();
    let generatedPassword: string | null = null;

    let userId: string | null = null;
    const existing = await supabaseAdmin.auth.admin.getUserByEmail(email);
    if (existing.error) {
      return NextResponse.json({ ok: false, error: existing.error.message }, { status: 400 });
    }
    if (existing.data?.user) {
      userId = existing.data.user.id;
    } else {
      const password = requestedPassword || randomPassword();
      const created = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { source: 'business-member', business_slug: slug },
      });
      if (created.error || !created.data?.user) {
        return NextResponse.json({ ok: false, error: created.error?.message || 'No se pudo crear el usuario' }, { status: 400 });
      }
      userId = created.data.user.id;
      generatedPassword = requestedPassword ? null : password;
    }

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'No se pudo resolver el usuario' }, { status: 400 });
    }

    const { data: existingMembership } = await supabaseAdmin
      .from('business_members')
      .select('role')
      .eq('business_id', bizId)
      .eq('user_id', userId)
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from('business_members')
      .upsert(
        { business_id: bizId, user_id: userId, role },
        { onConflict: 'business_id,user_id' }
      );
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const isExistingUser = !!existing.data?.user;
    const wasAlreadyMember = !!existingMembership;

    if (wasAlreadyMember) {
      return NextResponse.json({
        ok: true,
        info: 'El usuario ya formaba parte del negocio. Rol actualizado.',
      });
    }

    if (isExistingUser && !generatedPassword) {
      return NextResponse.json({ ok: true, info: 'Usuario agregado al negocio' });
    }

    return NextResponse.json({
      ok: true,
      password: generatedPassword,
      info: generatedPassword
        ? 'Usuario creado y agregado al negocio'
        : 'Usuario agregado al negocio',
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Error' }, { status: 500 });
  }
}
