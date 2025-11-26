"use server";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { adminEmails } from "@/utils/plan";

// Helpers compartidos (mismos que en product-option-groups).
// Helpers compartidos del panel admin (obtenemos slug, autenticamos, etc.).
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

async function groupBelongsToBusiness(groupId: string, businessId: string) {
  const { data } = await supabaseAdmin
    .from("option_groups")
    .select("id")
    .eq("id", groupId)
    .eq("business_id", businessId)
    .maybeSingle();
  return !!data;
}

async function optionBelongsToBusiness(optionId: string, businessId: string) {
  const { data } = await supabaseAdmin
    .from("options")
    .select("group_id")
    .eq("id", optionId)
    .maybeSingle();
  const groupId = (data as any)?.group_id as string | undefined;
  if (!groupId) return false;
  return groupBelongsToBusiness(groupId, businessId);
}

function sanitizeOptionPayload(body: any) {
  const name = String(body?.name || "").trim();
  if (!name) throw new Error("Nombre requerido");
  const priceDeltaRaw = body?.price_delta;
  const price_delta =
    priceDeltaRaw == null || priceDeltaRaw === ""
      ? 0
      : Number(priceDeltaRaw);
  if (!Number.isFinite(price_delta)) {
    throw new Error("Precio adicional inválido");
  }
  const sortRaw = body?.sort_order;
  const sort_order =
    sortRaw == null || sortRaw === ""
      ? null
      : Number(sortRaw);
  if (sort_order != null && !Number.isFinite(sort_order)) {
    throw new Error("Orden inválido");
  }
  return { name, price_delta, sort_order };
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
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  const group_id = String(body?.group_id || "").trim();
  if (!group_id) {
    return NextResponse.json({ ok: false, error: "group_id requerido" }, { status: 400 });
  }
  const belongs = await groupBelongsToBusiness(group_id, bid);
  if (!belongs) {
    return NextResponse.json({ ok: false, error: "Grupo no encontrado" }, { status: 404 });
  }
  let payload: ReturnType<typeof sanitizeOptionPayload>;
  try {
    payload = sanitizeOptionPayload(body);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Datos inválidos" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("options")
    .insert({ ...payload, group_id })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: (data as any)?.id });
}

// Actualiza una opción existente.
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
  const belongs = await optionBelongsToBusiness(id, bid);
  if (!belongs) {
    return NextResponse.json({ ok: false, error: "Opción no encontrada" }, { status: 404 });
  }
  let payload: ReturnType<typeof sanitizeOptionPayload>;
  try {
    payload = sanitizeOptionPayload(body);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Datos inválidos" }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("options").update(payload).eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

// Elimina una opción de topping del negocio.
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
  const belongs = await optionBelongsToBusiness(id, bid);
  if (!belongs) {
    return NextResponse.json({ ok: false, error: "Opción no encontrada" }, { status: 404 });
  }
  const { error } = await supabaseAdmin.from("options").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
