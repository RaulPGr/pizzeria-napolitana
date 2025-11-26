"use server";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { adminEmails } from "@/utils/plan";

// Utilidades de tenant/autenticación para el panel admin.
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

async function ensureGroupBelongs(businessId: string, groupId: string) {
  const { data } = await supabaseAdmin
    .from("option_groups")
    .select("id")
    .eq("id", groupId)
    .eq("business_id", businessId)
    .maybeSingle();
  return !!data;
}

// Comprueba que el grupo y el producto pertenecen al negocio antes de asignarlos.
async function ensureGroupAndProduct(
  businessId: string,
  groupId: string,
  productId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const groupOk = await ensureGroupBelongs(businessId, groupId);
  if (!groupOk) return { ok: false, error: "Grupo no encontrado" };
  const { data: product } = await supabaseAdmin
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("business_id", businessId as any)
    .maybeSingle();
  if (!product) return { ok: false, error: "Producto no encontrado" };
  return { ok: true };
}

// Devuelve todos los grupos/opciones/asignaciones para el panel de toppings.
export async function GET() {
  const auth = await assertAdminOrMember();
  if (!auth.ok) return auth.res;
  const slug = await getTenantSlug();
  const bid = await getBusinessIdBySlug(slug);
  if (!bid) {
    return NextResponse.json({
      ok: true,
      groups: [],
      options: [],
      assignments: [],
      products: [],
      categories: [],
      categoryAssignments: [],
    });
  }

  const { data: products } = await supabaseAdmin
    .from("products")
    .select("id, name, active, category_id, categories(name)")
    .eq("business_id", bid)
    .order("name", { ascending: true });
  const productList =
    (products || []).map((p: any) => ({
      id: Number(p.id),
      name: p.name,
      active: p.active,
      category_id: p.category_id,
      category_name: p.categories?.name || null,
    })) || [];
  const productIds = productList.map((p) => p.id);

  const { data: categoriesData } = await supabaseAdmin
    .from("categories")
    .select("id, name")
    .eq("business_id", bid)
    .order("sort_order", { ascending: true, nullsFirst: true })
    .order("name", { ascending: true });
  const categories =
    (categoriesData || []).map((c: any) => ({
      id: Number(c.id),
      name: c.name,
    })) || [];
  const categoryIds = categories.map((c) => c.id);

  const { data: groups, error: groupsError } = await supabaseAdmin
    .from("option_groups")
    .select("id, name, description, selection_type, min_select, max_select, is_required, sort_order, created_at")
    .eq("business_id", bid)
    .order("sort_order", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });
  if (groupsError) {
    return NextResponse.json({ ok: false, error: groupsError.message }, { status: 400 });
  }
  const groupIds = (groups || []).map((g) => g.id);

  let options: any[] = [];
  if (groupIds.length > 0) {
    const { data: optionsData } = await supabaseAdmin
      .from("options")
      .select("id, group_id, name, price_delta, sort_order")
      .in("group_id", groupIds);
    options = optionsData || [];
  }

  let assignments: any[] = [];
  if (productIds.length > 0) {
    const { data: assignData } = await supabaseAdmin
      .from("product_option_groups")
      .select("id, product_id, group_id")
      .in("product_id", productIds);
    assignments = assignData || [];
  }

  let categoryAssignments: any[] = [];
  if (categoryIds.length > 0 && groupIds.length > 0) {
    const { data: catAssignData } = await supabaseAdmin
      .from("category_option_groups")
      .select("id, category_id, group_id")
      .eq("business_id", bid)
      .in("category_id", categoryIds)
      .in("group_id", groupIds);
    categoryAssignments =
      (catAssignData || []).map((item: any) => ({
        id: item.id,
        category_id: Number(item.category_id),
        group_id: item.group_id,
      })) || [];
  }

  return NextResponse.json({
    ok: true,
    groups: groups || [],
    options,
    assignments,
    products: productList,
    categories,
    categoryAssignments,
  });
}

// Asigna un grupo a un producto concreto.
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
  const productId = Number(body?.product_id);
  if (!groupId || !productId) {
    return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });
  }
  const validation = await ensureGroupAndProduct(bid, groupId, productId);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }
  const { data: existing } = await supabaseAdmin
    .from("product_option_groups")
    .select("id")
    .eq("group_id", groupId)
    .eq("product_id", productId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, id: (existing as any).id });
  }
  const { data, error } = await supabaseAdmin
    .from("product_option_groups")
    .insert({ group_id: groupId, product_id: productId })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: (data as any)?.id });
}

// Elimina una asignación (por id o por par producto/grupo).
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
  const productIdParam = url.searchParams.get("product_id");
  const groupId = url.searchParams.get("group_id");

  if (!id && (!productIdParam || !groupId)) {
    return NextResponse.json({ ok: false, error: "Debes indicar id o par producto/grupo" }, { status: 400 });
  }

  if (id) {
    const { data } = await supabaseAdmin
      .from("product_option_groups")
      .select("product_id, group_id")
      .eq("id", id)
      .maybeSingle();
    if (!data) return NextResponse.json({ ok: true });
    const productId = Number((data as any).product_id);
    const validation = await ensureGroupAndProduct(bid, (data as any).group_id, productId);
    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: 404 });
    }
    await supabaseAdmin.from("product_option_groups").delete().eq("id", id);
    return NextResponse.json({ ok: true });
  }

  const productId = Number(productIdParam);
  if (!Number.isFinite(productId) || !groupId) {
    return NextResponse.json({ ok: false, error: "Par producto/grupo invalido" }, { status: 400 });
  }
  const validation = await ensureGroupAndProduct(bid, groupId, productId);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 404 });
  }
  await supabaseAdmin
    .from("product_option_groups")
    .delete()
    .eq("group_id", groupId)
    .eq("product_id", productId);
  return NextResponse.json({ ok: true });
}
