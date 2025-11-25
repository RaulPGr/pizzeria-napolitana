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

async function getUserByEmail(email: string) {
  const normalized = email.toLowerCase();
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw new Error(error.message);
    const users = Array.isArray(data?.users) ? data.users : [];
    const match = users.find((u) => (u.email || '').toLowerCase() === normalized);
    if (match) return match;
    if (!data || !Array.isArray(data.users) || data.users.length < perPage) {
      break;
    }
    page += 1;
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const slug = await getTenantSlug(req);
    if (!slug) return NextResponse.json({ ok: false, error: 'Missing tenant' }, { status: 400 });
    const bizId = await getBusinessId(slug);
    if (!bizId) return NextResponse.json({ ok: false, error: 'Business not found' }, { status: 404 });

    const { data: members, error } = await supabaseAdmin
      .from('business_members')
      .select('user_id, role, created_at, last_access_at')
      .eq('business_id', bizId)
      .order('created_at', { ascending: true });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const results: Array<{ userId: string; email: string | null; role: MemberRole; createdAt: string; lastAccessAt: string | null }> = [];
    for (const m of members || []) {
      const userId = (m as any)?.user_id as string | undefined;
      const role = (m as any)?.role as MemberRole;
      if (!userId) continue;
      try {
        const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (userErr) throw userErr;
        const email = userData.user?.email ?? null;
        results.push({
          userId,
          email,
          role,
          createdAt: (m as any)?.created_at || null,
          lastAccessAt: (m as any)?.last_access_at || null,
        });
      } catch {
        results.push({
          userId,
          email: null,
          role,
          createdAt: (m as any)?.created_at || null,
          lastAccessAt: (m as any)?.last_access_at || null,
        });
      }
    }

    return NextResponse.json({ ok: true, members: results });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const slug = await getTenantSlug(req);
    if (!slug) return NextResponse.json({ ok: false, error: 'Missing tenant' }, { status: 400 });
    const bizId = await getBusinessId(slug);
    if (!bizId) return NextResponse.json({ ok: false, error: 'Business not found' }, { status: 404 });

    let body: any = {};
    try {
      body = await req.json();
    } catch {}
    const emailRaw = typeof body?.email === 'string' ? body.email : '';
    const userIdRaw = typeof body?.userId === 'string' ? body.userId : '';
    let targetUserId = userIdRaw.trim() || '';
    if (!targetUserId && emailRaw) {
      const normalized = normalizeEmail(emailRaw);
      const user = await getUserByEmail(normalized).catch(() => null);
      if (user?.id) targetUserId = user.id as string;
    }
    if (!targetUserId) {
      return NextResponse.json({ ok: false, error: 'Faltan datos del usuario' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('business_members')
      .delete()
      .eq('business_id', bizId)
      .eq('user_id', targetUserId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Error' }, { status: 500 });
  }
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
    const existingUser = await getUserByEmail(email).catch(() => null);
    if (existingUser?.id) {
      userId = existingUser.id as string;
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

    const isExistingUser = !!existingUser?.id;
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
