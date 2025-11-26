"use server";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { adminEmails } from "@/utils/plan";

// Helpers compartidos para verificar acceso en el panel admin.
async function getTenantSlug(): Promise<string> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get("x-tenant-slug")?.value || "";
  } catch {
    return "";
  }
}

async function assertAdminOrMember(): Promise<{ ok: true; userId: string | null } | { ok: false; res: Response }> {
  try {
    const cookieStore = await cookies();
    const supa = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (n: string) => cookieStore.get(n)?.value,
          set: (n: string, v: string, o: any) => {
            try {
              cookieStore.set({ name: n, value: v, ...o });
            } catch {}
          },
          remove: (n: string, o: any) => {
            try {
              cookieStore.set({ name: n, value: "", ...o, maxAge: 0 });
            } catch {}
          },
        },
      }
    );
    const { data } = await supa.auth.getUser();
    const email = data.user?.email?.toLowerCase() || "";
    const userId = data.user?.id || null;
    const admins = adminEmails();
    let allowed = admins.length === 0 ? !!email : admins.includes(email);
    if (!allowed && userId) {
      const slug = cookieStore.get("x-tenant-slug")?.value || "";
      if (slug) {
        const { data: biz } = await supabaseAdmin.from("businesses").select("id").eq("slug", slug).maybeSingle();
        const bid = (biz as any)?.id as string | undefined;
        if (bid) {
          const { data: membership } = await supabaseAdmin
            .from("business_members")
            .select("user_id")
            .eq("business_id", bid)
            .eq("user_id", userId)
            .maybeSingle();
          allowed = !!membership;
        }
      }
    }
    if (!allowed) {
      return { ok: false, res: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
    }
    return { ok: true, userId };
  } catch {
    return { ok: false, res: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }
}

async function getBusinessIdBySlug(slug: string): Promise<string | null> {
  if (!slug) return null;
  const { data, error } = await supabaseAdmin.from("businesses").select("id").eq("slug", slug).maybeSingle();
  if (error) return null;
  return (data as any)?.id ?? null;
}

// Verifica que tanto grupo como categoría pertenecen al negocio actual.
async function ensureGroupAndCategory(
  businessId: string,
  groupId: string,
  categoryId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: group } = await supabaseAdmin
    .from("option_groups")
    .select("id")
    .eq("id", groupId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!group) return { ok: false, error: "Grupo no encontrado" };
  const { data: category } = await supabaseAdmin
    .from("categories")
    .select("id")
    .eq("id", categoryId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!category) return { ok: false, error: "Categoria no encontrada" };
  return { ok: true };
}

export async function POST(req: Request) {
  const auth = await assertAdminOrMember();
  if (!auth.ok) return auth.res;
  const slug = await getTenantSlug();
  const bid = await getBusinessIdBySlug(slug);
  if (!bid) {
    return NextResponse.json({ ok: false, error: "Negocio no encontrado" }, { status: 400 });
  }
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON invalido" }, { status: 400 });
  }
  const groupId = String(body?.group_id || "").trim();
  const categoryId = Number(body?.category_id);
  if (!groupId || !Number.isFinite(categoryId)) {
    return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });
  }
  const validation = await ensureGroupAndCategory(bid, groupId, categoryId);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }
  const { data: existing } = await supabaseAdmin
    .from("category_option_groups")
    .select("id")
    .eq("business_id", bid)
    .eq("category_id", categoryId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, id: (existing as any).id });
  }
  const { data, error } = await supabaseAdmin
    .from("category_option_groups")
    .insert({ business_id: bid, category_id: categoryId, group_id: groupId })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: (data as any)?.id });
}

export async function DELETE(req: Request) {
  const auth = await assertAdminOrMember();
  if (!auth.ok) return auth.res;
  const slug = await getTenantSlug();
  const bid = await getBusinessIdBySlug(slug);
  if (!bid) {
    return NextResponse.json({ ok: false, error: "Negocio no encontrado" }, { status: 400 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const categoryIdParam = url.searchParams.get("category_id");
  const groupId = url.searchParams.get("group_id");

  if (!id && (!categoryIdParam || !groupId)) {
    return NextResponse.json({ ok: false, error: "Debes indicar id o par categoria/grupo" }, { status: 400 });
  }

  if (id) {
    const { data } = await supabaseAdmin
      .from("category_option_groups")
      .select("category_id, group_id, business_id")
      .eq("id", id)
      .maybeSingle();
    if (!data) return NextResponse.json({ ok: true });
    if ((data as any).business_id !== bid) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }
    await supabaseAdmin.from("category_option_groups").delete().eq("id", id);
    return NextResponse.json({ ok: true });
  }

  const categoryId = Number(categoryIdParam);
  if (!Number.isFinite(categoryId) || !groupId) {
    return NextResponse.json({ ok: false, error: "Par categoria/grupo invalido" }, { status: 400 });
  }
  const validation = await ensureGroupAndCategory(bid, groupId, categoryId);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 404 });
  }
  await supabaseAdmin
    .from("category_option_groups")
    .delete()
    .eq("business_id", bid)
    .eq("category_id", categoryId)
    .eq("group_id", groupId);
  return NextResponse.json({ ok: true });
}
