// src/app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getTenant } from '@/lib/tenant';
import { notifyOrderViaTelegram } from '@/lib/order-telegram-notify';

type ItemOptionInput = {
  optionId?: string;
  name?: string;
  price_delta?: number;
  groupName?: string;
};

type ItemInput = {
  productId: number;
  quantity: number;
  unitPrice?: number;
  options?: ItemOptionInput[];
};
type BodyInput = {
  customer: { name: string; phone: string; email?: string };
  pickupAt: string; // ISO
  items: ItemInput[];
  paymentMethod: 'cash' | 'card';
  notes?: string;
  pricing?: {
    subtotal?: number;
    discount?: number;
    total?: number;
    promotionId?: string | null;
    promotionName?: string | null;
  };
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BodyInput;
    const url = new URL(req.url);
    const slugParam = url.searchParams.get('tenant');

    // 0) Cargar tenant (para asociar negocio). La validación estricta del horario se realiza en cliente.
    const tenant = await getTenant(slugParam, { path: url.pathname });
    if (!tenant) {
      return NextResponse.json(
        { ok: false, message: 'Negocio no encontrado' },
        { status: 400 }
      );
    }
    const ordersEnabled = ((tenant as any)?.social?.orders_enabled ?? true) !== false;
    if (!ordersEnabled) {
      return NextResponse.json(
        { ok: false, message: 'Los pedidos online estan desactivados' },
        { status: 403 }
      );
    }

    if (!body.customer?.name || !body.customer?.phone)
      return NextResponse.json(
        { ok: false, message: 'Faltan datos del cliente' },
        { status: 400 }
      );

    if (!Array.isArray(body.items) || body.items.length === 0)
      return NextResponse.json(
        { ok: false, message: 'Debes incluir al menos 1 item' },
        { status: 400 }
      );

    // Traer precios de productos y calcular totales en céntimos
    const productIds = [...new Set(body.items.map((i) => i.productId))];
    const { data: products, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('id, name, price')
      .in('id', productIds);
    if (prodErr) throw prodErr;

    const map = new Map(products?.map((p) => [p.id, p]) || []);
    const productCategoryMap = new Map<number, number | null>();
    (products || []).forEach((p: any) => {
      const pid = Number(p?.id);
      if (!Number.isFinite(pid)) return;
      const cid = p?.category_id != null ? Number(p.category_id) : null;
      productCategoryMap.set(pid, Number.isFinite(cid as number) ? (cid as number) : null);
    });
    const productsByCategory = new Map<number, number[]>();
    productCategoryMap.forEach((cid, pid) => {
      if (cid == null) return;
      if (!productsByCategory.has(cid)) productsByCategory.set(cid, []);
      productsByCategory.get(cid)!.push(pid);
    });
    const categoryIds = Array.from(new Set(Array.from(productCategoryMap.values()).filter((cid): cid is number => cid != null)));

    const productGroupAssignments: Array<{ product_id: number; group_id: string }> = productIds.length
      ? ((await supabaseAdmin
          .from("product_option_groups")
          .select("product_id, group_id")
          .in("product_id", productIds)) as any).data || []
      : [];
    const categoryGroupAssignments: Array<{ category_id: number; group_id: string }> =
      categoryIds.length > 0
        ? ((await supabaseAdmin
            .from("category_option_groups")
            .select("category_id, group_id")
            .eq("business_id", (tenant as any)?.id || null)
            .in("category_id", categoryIds)) as any).data || []
        : [];
    const allowedGroupsByProduct = new Map<number, Set<string>>();
    const allRelevantGroupIds = new Set<string>();
    const addGroup = (pid: number, groupId: string) => {
      if (!allowedGroupsByProduct.has(pid)) allowedGroupsByProduct.set(pid, new Set());
      allowedGroupsByProduct.get(pid)!.add(groupId);
      allRelevantGroupIds.add(groupId);
    };
    for (const row of productGroupAssignments) {
      const pid = Number(row.product_id);
      if (!Number.isFinite(pid)) continue;
      addGroup(pid, row.group_id);
    }
    for (const row of categoryGroupAssignments) {
      const cid = Number(row.category_id);
      if (!Number.isFinite(cid)) continue;
      const productsForCat = productsByCategory.get(cid) || [];
      for (const pid of productsForCat) {
        addGroup(pid, row.group_id);
      }
    }

    const groupMetaMap = new Map<
      string,
      { id: string; name: string | null; selection_type: "single" | "multiple"; min_select?: number | null; max_select?: number | null; is_required?: boolean }
    >();
    if (allRelevantGroupIds.size > 0) {
      const { data: groupRows } = await supabaseAdmin
        .from("option_groups")
        .select("id, name, selection_type, min_select, max_select, is_required")
        .in("id", Array.from(allRelevantGroupIds));
      (groupRows || []).forEach((row: any) => {
        groupMetaMap.set(row.id, {
          id: row.id,
          name: row.name,
          selection_type: (row.selection_type || "single") as "single" | "multiple",
          min_select: row.min_select,
          max_select: row.max_select,
          is_required: row.is_required,
        });
      });
    }

    const requestedOptionIds = new Set<string>();
    for (const item of body.items) {
      if (!Array.isArray(item.options)) continue;
      for (const opt of item.options) {
        const optId = String(opt.optionId ?? "").trim();
        if (optId) requestedOptionIds.add(optId);
      }
    }
    const optionRowMap = new Map<
      string,
      { id: string; name: string; price_delta: number; group_id: string }
    >();
    if (requestedOptionIds.size > 0) {
      const { data: optionRows, error: optionErr } = await supabaseAdmin
        .from("options")
        .select("id, name, price_delta, group_id")
        .in("id", Array.from(requestedOptionIds));
      if (optionErr) throw optionErr;
      (optionRows || []).forEach((row: any) => {
        optionRowMap.set(row.id, {
          id: row.id,
          name: row.name,
          price_delta: Number(row.price_delta || 0),
          group_id: row.group_id,
        });
        allRelevantGroupIds.add(row.group_id);
        if (!groupMetaMap.has(row.group_id)) {
          groupMetaMap.set(row.group_id, {
            id: row.group_id,
            name: null,
            selection_type: "single",
            min_select: null,
            max_select: null,
            is_required: false,
          });
        }
      });
      const missingOptions = Array.from(requestedOptionIds).filter((id) => !optionRowMap.has(id));
      if (missingOptions.length > 0) {
        throw new Error("Alguna opción seleccionada no existe");
      }
    }

    let subtotalCents = 0;
    const itemsPrepared = body.items.map((i) => {
      const p = map.get(i.productId);
      if (!p) {
        throw new Error(`Producto no existe (id=${i.productId})`);
      }
      const normalizedSelections: Array<{
        option_id: string | null;
        name_snapshot: string;
        price_delta_snapshot: number;
        group_name_snapshot: string | null;
        group_id: string;
      }> = [];
      const allowedGroups = allowedGroupsByProduct.get(i.productId) || new Set<string>();
      const requestedOptions = Array.isArray(i.options) ? i.options : [];
      const selectionCounts = new Map<string, number>();
      for (const opt of requestedOptions) {
        const optionId = String(opt.optionId ?? "").trim();
        if (!optionId) continue;
        const optionRow = optionRowMap.get(optionId);
        if (!optionRow) {
          throw new Error("Opción seleccionada no existe");
        }
        if (!allowedGroups.has(optionRow.group_id)) {
          throw new Error("Opción no permitida para este producto");
        }
        const groupMeta = groupMetaMap.get(optionRow.group_id);
        const priceDelta = Number(optionRow.price_delta || 0);
        normalizedSelections.push({
          option_id: optionRow.id,
          name_snapshot: optionRow.name,
          price_delta_snapshot: priceDelta,
          group_name_snapshot: groupMeta?.name || opt.groupName || null,
          group_id: optionRow.group_id,
        });
        selectionCounts.set(optionRow.group_id, (selectionCounts.get(optionRow.group_id) || 0) + 1);
      }
      allowedGroups.forEach((groupId) => {
        const meta = groupMetaMap.get(groupId);
        if (!meta) return;
        const selectionType = meta.selection_type || "single";
        const min = meta.min_select != null ? Number(meta.min_select) : meta.is_required !== false && selectionType === "single" ? 1 : 0;
        const max = meta.max_select != null ? Number(meta.max_select) : selectionType === "single" ? 1 : null;
        const count = selectionCounts.get(groupId) || 0;
        if (min > 0 && count < min) {
          throw new Error(`Faltan opciones obligatorias en ${meta.name || "el producto"}`);
        }
        if (max != null && count > max) {
          throw new Error(`Demasiadas opciones seleccionadas en ${meta.name || "el producto"}`);
        }
      });
      const optionsDeltaCents = normalizedSelections.reduce((sum, opt) => sum + Math.round(opt.price_delta_snapshot * 100), 0);
      const unit_price_cents = Math.round(Number(p.price) * 100) + optionsDeltaCents;
      const line_total_cents = unit_price_cents * i.quantity;
      subtotalCents += line_total_cents;
      return {
        product_id: i.productId,
        name: p.name,
        unit_price_cents,
        quantity: i.quantity,
        line_total_cents,
        options_snapshot: normalizedSelections,
      };
    });

    let discountCents = 0;
    let promotionId: string | null = null;
    let promotionName: string | null = body.pricing?.promotionName ? String(body.pricing.promotionName).slice(0, 120) : null;
    if (body.pricing) {
      const requestedDiscount = Math.round(Number(body.pricing.discount ?? 0) * 100);
      if (Number.isFinite(requestedDiscount) && requestedDiscount > 0) {
        discountCents = Math.min(requestedDiscount, subtotalCents);
      }
    }
    const finalTotalCents = Math.max(0, subtotalCents - discountCents);

    const requestedPromotionId = body.pricing?.promotionId ? String(body.pricing.promotionId).trim() : '';
    if (requestedPromotionId) {
      try {
        const { data: promo } = await supabaseAdmin
          .from('promotions')
          .select('id, name')
          .eq('id', requestedPromotionId)
          .eq('business_id', (tenant as any)?.id || null)
          .maybeSingle();
        if (promo?.id) {
          promotionId = promo.id as string;
          if (!promotionName) promotionName = (promo as any)?.name || null;
        }
      } catch {}
    }

    // Decidir estado inicial según método de pago
    const initialStatus = body.paymentMethod === 'card' ? 'confirmed' : 'pending';

    // Insertar pedido
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_name: body.customer.name,
        customer_phone: body.customer.phone,
        customer_email: body.customer.email || null,
        pickup_at: body.pickupAt ? new Date(body.pickupAt).toISOString() : null,
        status: initialStatus,
        total_cents: finalTotalCents,
        discount_cents: discountCents,
        promotion_id: promotionId,
        promotion_name: promotionName,
        payment_method: body.paymentMethod,
        payment_status: 'unpaid',
        notes: body.notes || null,
        business_id: (tenant as any)?.id || null,
      })
      .select('id')
      .single();
    if (insErr) throw insErr;

    const orderId: string = inserted.id;

    // Generar code corto (p.ej. primeros 7 chars del uuid)
    const code = orderId.split('-')[0];
    const { error: upErr } = await supabaseAdmin
      .from('orders')
      .update({ code })
      .eq('id', orderId);
    if (upErr) throw upErr;

    // Insertar los items
    const itemsPayload = itemsPrepared.map((it) => {
      const { options_snapshot, ...rest } = it;
      return { ...rest, order_id: orderId, business_id: (tenant as any)?.id || null };
    });
    const { data: insertedItems, error: itemsErr } = await supabaseAdmin
      .from('order_items')
      .insert(itemsPayload)
      .select('id');
    if (itemsErr) throw itemsErr;

    const optionRows: Array<{
      order_item_id: string;
      option_id: string | null;
      name_snapshot: string;
      price_delta_snapshot: number;
      group_name_snapshot?: string | null;
      business_id: string | null;
    }> = [];
    if (insertedItems && insertedItems.length === itemsPrepared.length) {
      insertedItems.forEach((row, index) => {
        const snapshots = itemsPrepared[index].options_snapshot || [];
        snapshots.forEach((snap) => {
          optionRows.push({
            order_item_id: row.id,
            option_id: snap.option_id,
            name_snapshot: snap.name_snapshot,
            price_delta_snapshot: snap.price_delta_snapshot,
            group_name_snapshot: snap.group_name_snapshot,
            business_id: (tenant as any)?.id || null,
          });
        });
      });
      if (optionRows.length > 0) {
        await supabaseAdmin.from('order_item_options').insert(optionRows);
      }
    }
    ;(async () => {
      try {
        // Enviar SIEMPRE si el pedido trae email del cliente (no bloquea la respuesta)
        const { data: business } = await supabaseAdmin
          .from('businesses')
          .select('name, email, address_line, city, postal_code, logo_url, social')
          .eq('id', (tenant as any)?.id || null)
          .maybeSingle();
        const optionLabel = (opt: any) => {
          const base = opt.group_name_snapshot ? `${opt.group_name_snapshot}: ${opt.name_snapshot}` : opt.name_snapshot;
          const priceDelta = Number(opt.price_delta_snapshot || 0);
          if (priceDelta) {
            const formatted = priceDelta.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
            const sign = priceDelta > 0 ? "+" : "-";
            return `${base} (${sign}${formatted})`;
          }
          return base;
        };
        const itemsSimple = itemsPrepared.map((it) => ({
          name: it.name,
          qty: it.quantity,
          price: it.unit_price_cents / 100,
          options: (it.options_snapshot || []).map(optionLabel),
        }));
        const subtotal = itemsSimple.reduce((a, it) => a + it.price * it.qty, 0);
        const { sendOrderReceiptEmail, sendOrderBusinessNotificationEmail } = await import('@/lib/email/sendOrderReceipt');
        if (body.customer?.email) {
          await sendOrderReceiptEmail({
            orderId,
            orderCode: code,
            businessName: (business as any)?.name || 'PideLocal',
            businessAddress: [ (business as any)?.address_line, (business as any)?.postal_code, (business as any)?.city ]
              .filter(Boolean)
              .join(', ') || undefined,
            businessLogoUrl: (business as any)?.logo_url || undefined,
            customerEmail: body.customer.email,
            customerName: body.customer.name,
            items: itemsSimple,
            subtotal,
            total: finalTotalCents / 100,
            pickupTime: body.pickupAt,
            notes: body.notes || undefined,
            discount: discountCents / 100,
            promotionName: promotionName || undefined,
          });
        }
        const notifySettings = (business as any)?.social || {};
        const notifyEnabled = !!notifySettings?.notify_orders_enabled;
        const notifyTarget =
          (notifySettings?.notify_orders_email && String(notifySettings.notify_orders_email).trim()) ||
          (business as any)?.email ||
          null;
        if (notifyEnabled && notifyTarget) {
          await sendOrderBusinessNotificationEmail({
            orderId,
            orderCode: code,
            businessName: (business as any)?.name || 'PideLocal',
            businessAddress: [ (business as any)?.address_line, (business as any)?.postal_code, (business as any)?.city ]
              .filter(Boolean)
              .join(', ') || undefined,
            businessLogoUrl: (business as any)?.logo_url || undefined,
            businessEmail: notifyTarget,
            items: itemsSimple,
            total: finalTotalCents / 100,
            customerName: body.customer.name,
            customerPhone: body.customer.phone,
            customerEmail: body.customer.email || null,
            pickupTime: body.pickupAt,
            notes: body.notes || undefined,
          });
        }
      } catch (e) {
        console.error('[email] create-order (non-blocking) fallo:', e);
      }
    })();

    try {
      const result = await notifyOrderViaTelegram(orderId, {
        ...(tenant as any)?.social,
        slug: (tenant as any)?.slug || "",
        businessName: (tenant as any)?.name || "",
      });
      if (!result.ok && !result.skip) {
        console.error(`[telegram] order ${orderId} fallo: ${result.error}`);
      }
    } catch (err) {
      console.error('[telegram] unexpected error', err);
    }
    return NextResponse.json({ ok: true, orderId, code });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: err?.message || 'Error creando pedido' },
      { status: 400 }
    );
  }
}


