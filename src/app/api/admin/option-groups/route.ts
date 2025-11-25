"use server";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { adminEmails } from "@/utils/plan";

type SelectionType = "single" | "multiple";

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

function sanitizeGroupPayload(body: any) {
  const name = String(body?.name || "").trim();
  if (!name) throw new Error("El nombre es obligatorio");
  const description =
    body?.description == null ? null : String(body.description).trim() || null;
  const selectionRaw = String(body?.selection_type || "single").toLowerCase();
  const selection_type: SelectionType = selectionRaw === "multiple" ? "multiple" : "single";
  const minRaw = body?.min_select;
  const maxRaw = body?.max_select;
  const min_select =
    minRaw == null || minRaw === ""
      ? null
      : Number(minRaw);
  const max_select =
    maxRaw == null || maxRaw === ""
      ? null
      : Number(maxRaw);
  if (min_select != null && (!Number.isFinite(min_select) || min_select < 0)) {
    throw new Error("Mínimo inválido");
  }
  if (max_select != null && (!Number.isFinite(max_select) || max_select <= 0)) {
    throw new Error("Máximo inválido");
  }
  if (
    min_select != null &&
    max_select != null &&
    min_select > max_select
  ) {
    throw new Error("El mínimo no puede superar al máximo");
  }
  const is_required = body?.is_required === true || body?.is_required === "true";
  const sort_order =
    body?.sort_order == null || body.sort_order === ""
      ? null
      : Number(body.sort_order);
  if (sort_order != null && !Number.isFinite(sort_order)) {
    throw new Error("El orden debe ser un número");
  }
  return { name, description, selection_type, min_select, max_select, is_required, sort_order };
}

export async function GET() {
  const auth = await assertAdminOrMember();
  if (!auth.ok) return auth.res;
  const slug = await getTenantSlug();
  const bid = await getBusinessIdBySlug(slug);
  if (!bid) return NextResponse.json({ ok: true, groups: [], counts: {} });

  const { data: groups, error } = await supabaseAdmin
    .from("option_groups")
    .select("id, name, description, selection_type, min_select, max_select, is_required, sort_order, created_at")
    .eq("business_id", bid)
    .order("sort_order", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  const groupIds = (groups || []).map((g) => g.id);
  if (groupIds.length === 0) {
    return NextResponse.json({ ok: true, groups: [], counts: {} });
  }
  const { data: options } = await supabaseAdmin
    .from("options")
    .select("id, group_id")
    .in("group_id", groupIds);
  const counts = Object.create(null) as Record<string, number>;
  (options || []).forEach((opt) => {
    if (!opt?.group_id) return;
    counts[opt.group_id] = (counts[opt.group_id] || 0) + 1;
  });
  return NextResponse.json({ ok: true, groups: groups || [], counts });
}

export async function POST(req: Request) {
  const auth = await assertAdminOrMember();
  if (!auth.ok) return auth.res;
  const slug = await getTenantSlug();
  const bid = await getBusinessIdBySlug(slug);
  if (!bid) {
    return NextResponse.json({ ok: false, error: "Negocio no encontrado" }, { status: 400 });
  }
  let payload: ReturnType<typeof sanitizeGroupPayload>;
  try {
    const body = await req.json();
    payload = sanitizeGroupPayload(body);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Datos inválidos" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("option_groups")
    .insert({ ...payload, business_id: bid })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: (data as any)?.id });
}

export async function PATCH(req: Request) {
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
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  const id = String(body?.id || "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "ID requerido" }, { status: 400 });
  }
  let payload: ReturnType<typeof sanitizeGroupPayload>;
  try {
    payload = sanitizeGroupPayload(body);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Datos inválidos" }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from("option_groups")
    .update(payload)
    .eq("id", id)
    .eq("business_id", bid);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
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
  const id = url.searchParams.get("id") || "";
  if (!id) {
    return NextResponse.json({ ok: false, error: "ID requerido" }, { status: 400 });
  }
  try {
    await supabaseAdmin.from("options").delete().eq("group_id", id);
  } catch {}
  try {
    await supabaseAdmin.from("product_option_groups").delete().eq("group_id", id);
  } catch {}
  const { error } = await supabaseAdmin
    .from("option_groups")
    .delete()
    .eq("id", id)
    .eq("business_id", bid);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
