import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type AdminRole = "admin_owner" | "admin_manager";

type AdminPayload = {
  sub: string;
  role: AdminRole;
  exp?: number;
  iat?: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ADMIN_JWT_SECRET = Deno.env.get("ADMIN_JWT_SECRET") ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ADMIN_JWT_SECRET) {
  console.error("admin-panel: missing required secrets");
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(input: string) {
  return (input || "").replace(/\D/g, "");
}

function normalizeSearch(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

async function verifyJWT(token: string, secret: string): Promise<AdminPayload | null> {
  try {
    const [header, payload, signature] = token.split(".");
    if (!header || !payload || !signature) return null;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const signatureBytes = Uint8Array.from(
      atob(signature.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(`${header}.${payload}`),
    );

    if (!valid) return null;

    const decoded = JSON.parse(atob(payload)) as AdminPayload;
    if (!decoded?.sub || !decoded?.role) return null;
    if (decoded.exp && Date.now() / 1000 > decoded.exp) return null;
    return decoded;
  } catch {
    return null;
  }
}

async function authenticate(req: Request) {
  const token = req.headers.get("x-admin-token") || "";
  const payload = await verifyJWT(token, ADMIN_JWT_SECRET);

  if (!payload) return null;

  const { data: adminUser, error } = await adminClient
    .from("admin_users")
    .select("username, role, is_active")
    .eq("username", payload.sub)
    .maybeSingle();

  if (error || !adminUser || !adminUser.is_active) return null;

  return {
    username: adminUser.username as string,
    role: adminUser.role as AdminRole,
  };
}

async function upsertCustomerByPhone(payload: {
  id?: string;
  name: string;
  phone: string;
  type: "PF" | "PJ";
  cnpj?: string | null;
  email?: string | null;
}) {
  const cleanPhone = normalizePhone(payload.phone);
  if (!cleanPhone) throw new Error("Telefone é obrigatório");

  if (payload.id) {
    const { data, error } = await adminClient
      .from("customers")
      .update({
        name: payload.name,
        phone: cleanPhone,
        type: payload.type,
        cnpj: payload.type === "PJ" ? payload.cnpj || null : null,
        email: payload.email || null,
      })
      .eq("id", payload.id)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  const { data: existing } = await adminClient
    .from("customers")
    .select("id")
    .eq("phone", cleanPhone)
    .eq("type", payload.type)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await adminClient
      .from("customers")
      .update({
        name: payload.name,
        cnpj: payload.type === "PJ" ? payload.cnpj || null : null,
        email: payload.email || null,
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await adminClient
    .from("customers")
    .insert({
      name: payload.name,
      phone: cleanPhone,
      type: payload.type,
      cnpj: payload.type === "PJ" ? payload.cnpj || null : null,
      email: payload.email || null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const admin = await authenticate(req);
  if (!admin) {
    return json({ error: "Sem permissão para executar esta ação. Verifique se você está logado como admin." }, 401);
  }

  try {
    const { action, payload } = await req.json();

    if (action === "orders.list") {
      const page = Math.max(0, Number(payload?.page ?? 0) | 0);
      const pageSize = Math.min(200, Math.max(1, Number(payload?.pageSize ?? 50) | 0));
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await adminClient
        .from("orders")
        .select(`
          id, channel, delivery_date, delivery_time, status, notes, created_at, fulfillment_type, payment_method, payment_method_2, payment_amount_1, payment_amount_2, change_for_2, is_split_payment, total_amount, change_for, rider_id, pix_paid, pix_paid_at, em_rota_at, updated_at, updated_by, scheduled_date, scheduled_time, reminder_enabled, reminder_dismissed,
          customers(id, name, phone, cnpj, type),
          addresses(street, number, neighborhood, city, complement, reference),
          order_items(qty, product_id, products(name))
        `, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;

      // Enrich with rider name
      const riderIds = [...new Set((data || []).map((o: any) => o.rider_id).filter(Boolean))];
      let ridersMap: Record<string, string> = {};
      if (riderIds.length > 0) {
        const { data: ridersData } = await adminClient.from("delivery_riders").select("id, name").in("id", riderIds);
        (ridersData || []).forEach((r: any) => { ridersMap[r.id] = r.name; });
      }
      const enriched = (data || []).map((o: any) => ({ ...o, rider_name: o.rider_id ? ridersMap[o.rider_id] || "—" : undefined }));
      return json({ data: { rows: enriched, total: count ?? 0, page, pageSize } });
    }

    if (action === "orders.updateStatus") {
      const orderId = payload?.orderId as string;
      const newStatus = payload?.status as string;
      if (!orderId || !newStatus) throw new Error("Pedido/status inválido");

      if (newStatus === "em_rota") {
        const { data: results, error: rotaError } = await adminClient.rpc("mark_orders_em_rota", {
          p_order_ids: [orderId],
          p_created_by: admin.username,
        });
        if (rotaError) throw rotaError;
        const result = (results as { ok: boolean; error?: string }[] | null)?.[0];
        if (result && !result.ok) throw new Error(result.error || "Não foi possível colocar o pedido em rota.");
        return json({ ok: true });
      }

      const { error } = await adminClient
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "orders.createAdmin") {
      const channel = (payload?.channel || "admin") as "admin" | "ligacao" | "whatsapp";
      const customer = payload?.customer;
      const address = payload?.address;
      const items = payload?.items as { product_id: string; qty: number }[];
      const fulfillmentType = payload?.fulfillment_type || "delivery";
      const paymentMethod = payload?.payment_method || null;
      const paymentMethod2 = payload?.payment_method_2 || null;
      const paymentAmount1 = payload?.payment_amount_1 ?? null;
      const paymentAmount2 = payload?.payment_amount_2 ?? null;
      const isSplitPayment = !!payload?.is_split_payment;
      const totalAmount = payload?.total_amount ?? null;
      const changeFor = payload?.change_for ?? null;
      const changeFor2 = payload?.change_for_2 ?? null;

      if (!Array.isArray(items) || items.length === 0) {
        throw new Error("Selecione ao menos um produto.");
      }

      let customerId: string | null = null;
      let addressId: string | null = null;

      // Customer is optional for pickup / walk-in orders
      if (customer?.name && customer?.phone) {
        const customerRow = await upsertCustomerByPhone({
          name: customer.name,
          phone: customer.phone,
          type: customer.type || "PF",
          cnpj: customer.cnpj,
          email: customer.email,
        });
        customerId = customerRow.id;

        // Address with customer
        if (address?.street && address?.number && fulfillmentType === "delivery") {
          const { data: addressRow, error: addressError } = await adminClient
            .from("addresses")
            .insert({
              customer_id: customerRow.id,
              street: address.street,
              number: address.number,
              neighborhood: address.neighborhood || "—",
              city: address.city || "Santo André",
              state: address.state || "SP",
              complement: address.complement || null,
              zip: address.zip || null,
              is_primary: true,
            })
            .select("id")
            .single();

          if (addressError) throw addressError;
          addressId = addressRow.id;
        }
      } else if (address?.street && address?.number && fulfillmentType === "delivery") {
        // Address WITHOUT customer (no phone) — save address with null customer_id
        const { data: addressRow, error: addressError } = await adminClient
          .from("addresses")
          .insert({
            customer_id: null,
            street: address.street,
            number: address.number,
            neighborhood: address.neighborhood || "—",
            city: address.city || "Santo André",
            state: address.state || "SP",
            complement: address.complement || null,
            zip: address.zip || null,
          })
          .select("id")
          .single();

        if (addressError) throw addressError;
        addressId = addressRow.id;
      }

      const scheduledDate = payload?.scheduled_date || payload?.delivery_date || null;
      const scheduledTime = payload?.scheduled_time || payload?.delivery_time || null;

      const { data: order, error: orderError } = await adminClient
        .from("orders")
        .insert({
          channel,
          customer_id: customerId,
          address_id: addressId,
          notes: payload?.notes || null,
          delivery_date: payload?.delivery_date || null,
          delivery_time: payload?.delivery_time || null,
          status: "novo",
          fulfillment_type: fulfillmentType,
          payment_method: paymentMethod,
          payment_method_2: paymentMethod2,
          payment_amount_1: paymentAmount1,
          payment_amount_2: paymentAmount2,
          is_split_payment: isSplitPayment,
          total_amount: totalAmount,
          change_for: changeFor,
          change_for_2: changeFor2,
          scheduled_date: scheduledDate,
          scheduled_time: scheduledTime,
        })
        .select("id")
        .single();

      if (orderError) throw orderError;

      const { error: itemsError } = await adminClient.from("order_items").insert(
        items.map((item) => ({
          order_id: order.id,
          product_id: item.product_id,
          qty: item.qty,
        })),
      );

      if (itemsError) throw itemsError;

      return json({ data: { order_id: order.id, customer_id: customerId } });
    }

    if (action === "customers.list") {
      const { data, error } = await adminClient
        .from("customers")
        .select("*, addresses(id, street, number, neighborhood, city, state, complement, zip, reference, is_primary)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return json({ data });
    }

    if (action === "customers.orders") {
      const customerId = payload?.customerId as string;
      const { data, error } = await adminClient
        .from("orders")
        .select("id, status, created_at, channel, order_items(qty, products(name))")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return json({ data });
    }

    if (action === "customers.save") {
      const name = ((payload?.name as string) || "").trim() || "Sem nome";
      const phone = normalizePhone(payload?.phone || "");
      const pType = (payload?.type || "PF") as "PF" | "PJ";

      let data: any;
      if (payload?.id) {
        const { data: updated, error } = await adminClient
          .from("customers")
          .update({
            name,
            phone: phone || null,
            type: pType,
            cnpj: pType === "PJ" ? payload.cnpj || null : null,
            email: payload.email || null,
          })
          .eq("id", payload.id)
          .select("*")
          .single();
        if (error) throw error;
        data = updated;
      } else if (phone) {
        data = await upsertCustomerByPhone({
          name,
          phone,
          type: pType,
          cnpj: payload?.cnpj,
          email: payload?.email,
        });
      } else {
        const { data: inserted, error } = await adminClient
          .from("customers")
          .insert({
            name,
            phone: null,
            type: pType,
            cnpj: pType === "PJ" ? payload?.cnpj || null : null,
            email: payload?.email || null,
          })
          .select("*")
          .single();
        if (error) throw error;
        data = inserted;
      }

      // Handle address if provided
      const addr = payload?.address;
      if (addr && addr.street && addr.number && addr.neighborhood) {
        const { data: existingAddr } = await adminClient
          .from("addresses")
          .select("id")
          .eq("customer_id", data.id)
          .eq("is_primary", true)
          .maybeSingle();

        if (existingAddr) {
          await adminClient.from("addresses").update({
            street: addr.street,
            number: addr.number,
            neighborhood: addr.neighborhood,
            city: addr.city || "Santo André",
            state: addr.state || "SP",
            complement: addr.complement || null,
            zip: addr.zip || null,
            reference: addr.reference || null,
          }).eq("id", existingAddr.id);
        } else {
          await adminClient.from("addresses").insert({
            customer_id: data.id,
            street: addr.street,
            number: addr.number,
            neighborhood: addr.neighborhood,
            city: addr.city || "Santo André",
            state: addr.state || "SP",
            complement: addr.complement || null,
            zip: addr.zip || null,
            reference: addr.reference || null,
            is_primary: true,
          });
        }
      }

      return json({ data });
    }

    if (action === "customers.search") {
      const q = ((payload?.query as string) || "").trim();
      if (q.length < 2) return json({ data: [] });

      const normalized = normalizeSearch(q);

      const { data: byNamePhone, error: e1 } = await adminClient
        .from("customers")
        .select("id, name, phone, type, cnpj, email, created_at, addresses(id, street, number, neighborhood, city, state, complement, zip, reference, is_primary)")
        .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
        .order("name")
        .limit(15);
      if (e1) throw e1;

      const { data: addrMatches, error: e2 } = await adminClient
        .from("addresses")
        .select("customer_id")
        .ilike("street", `%${q}%`)
        .limit(20);
      if (e2) throw e2;

      const streetCustomerIds = (addrMatches || [])
        .map((a: any) => a.customer_id)
        .filter((id: string) => id && !(byNamePhone || []).some((c: any) => c.id === id));

      let byStreet: any[] = [];
      if (streetCustomerIds.length > 0) {
        const { data: streetCustomers, error: e3 } = await adminClient
          .from("customers")
          .select("id, name, phone, type, cnpj, email, created_at, addresses(id, street, number, neighborhood, city, state, complement, zip, reference, is_primary)")
          .in("id", streetCustomerIds)
          .order("name")
          .limit(10);
        if (e3) throw e3;
        byStreet = streetCustomers || [];
      }

      const allResults = [...(byNamePhone || []), ...byStreet];
      const fuzzyFiltered = allResults.filter((c: any) => {
        const nName = normalizeSearch(c.name || "");
        const nPhone = normalizeSearch(c.phone || "");
        if (nName.includes(normalized) || nPhone.includes(normalized)) return true;
        if (c.addresses?.some((a: any) => normalizeSearch(a.street || "").includes(normalized))) return true;
        return true;
      });

      return json({ data: fuzzyFiltered.slice(0, 15) });
    }

    if (action === "categories.list") {
      const { data, error } = await adminClient
        .from("product_categories")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return json({ data });
    }

    if (action === "products.list") {
      const [{ data: products, error: prodError }, { data: tiers, error: tierError }, { data: categories, error: catError }] = await Promise.all([
        adminClient.from("products").select("*").order("created_at"),
        adminClient.from("wholesale_price_tiers").select("*").order("min_qty"),
        adminClient.from("product_categories").select("*").order("sort_order"),
      ]);
      if (prodError) throw prodError;
      if (tierError) throw tierError;
      if (catError) throw catError;
      return json({ data: { products, tiers, categories } });
    }

    if (action === "products.save") {
      const product = payload?.product;
      const tiers = (payload?.tiers || []) as { min_qty: number; price_text: string }[];
      if (!product?.name) throw new Error("Nome do produto é obrigatório.");

      const productData: any = {
        name: product.name,
        description: product.description || null,
        type: product.type,
        icon: product.icon || null,
        active: product.active,
        price_text: product.price_text || null,
        track_stock: !!product.track_stock,
        min_stock_qty: product.min_stock_qty || 0,
        category_id: product.category_id || null,
        show_in_quick_order: !!product.show_in_quick_order,
        image_url: product.image_url || null,
      };

      let productId = product.id as string | undefined;
      if (productId) {
        const { error } = await adminClient.from("products").update(productData).eq("id", productId);
        if (error) throw error;
      } else {
        const { data, error } = await adminClient
          .from("products")
          .insert({ ...productData, stock_qty: product.stock_qty || 0 })
          .select("id")
          .single();
        if (error) throw error;
        productId = data.id;
      }

      if (product.type === "atacado" || product.type === "ambos") {
        const { error: deleteErr } = await adminClient.from("wholesale_price_tiers").delete().eq("product_id", productId);
        if (deleteErr) throw deleteErr;

        const validTiers = tiers.filter((t) => Number(t.min_qty) > 0);
        if (validTiers.length > 0) {
          const { error: tierErr } = await adminClient.from("wholesale_price_tiers").insert(
            validTiers.map((t) => ({ product_id: productId, min_qty: t.min_qty, price_text: t.price_text || "Consulte" })),
          );
          if (tierErr) throw tierErr;
        }
      }

      return json({ ok: true });
    }

    if (action === "products.delete") {
      const id = payload?.id as string;
      if (!id) throw new Error("Produto inválido.");
      const { error } = await adminClient.from("products").delete().eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "stock.adjust") {
      const { error } = await adminClient.rpc("adjust_stock", {
        p_product_id: payload?.product_id,
        p_qty: payload?.qty,
        p_type: payload?.type,
        p_reason: payload?.reason || null,
        p_created_by: admin.username,
      });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "reports.summary") {
      if (admin.role !== "admin_owner") {
        return json({ error: "Acesso negado. Apenas o proprietário pode acessar relatórios." }, 403);
      }
      const dateStart = payload?.dateStart as string;
      const dateEnd = payload?.dateEnd as string;
      if (!dateStart || !dateEnd) throw new Error("Período inválido.");

      const [summaryRes, revenueRes, productsRes] = await Promise.all([
        adminClient.rpc("get_orders_summary", { date_start: dateStart, date_end: dateEnd }),
        adminClient.rpc("get_revenue_by_payment_method", { date_start: dateStart, date_end: dateEnd }),
        adminClient.rpc("get_sales_by_product", { date_start: dateStart, date_end: dateEnd }),
      ]);

      if (summaryRes.error) throw summaryRes.error;
      if (revenueRes.error) throw revenueRes.error;
      if (productsRes.error) throw productsRes.error;

      const summary = (summaryRes.data && summaryRes.data[0]) || { total_orders: 0, delivered: 0, cancelled: 0, total_items: 0 };

      return json({
        data: {
          summary: {
            total_orders: Number(summary.total_orders ?? 0),
            delivered: Number(summary.delivered ?? 0),
            cancelled: Number(summary.cancelled ?? 0),
            total_items: Number(summary.total_items ?? 0),
          },
          revenue: (revenueRes.data || []).map((r: any) => ({
            payment_method: r.payment_method,
            total: Number(r.total ?? 0),
            order_count: Number(r.order_count ?? 0),
          })),
          products: (productsRes.data || []).map((p: any) => ({
            product_name: p.product_name,
            qty: Number(p.qty ?? 0),
          })),
        },
      });
    }

    if (action === "reports.orders") {
      if (admin.role !== "admin_owner") {
        return json({ error: "Acesso negado. Apenas o proprietário pode acessar relatórios." }, 403);
      }

      const dateStart = payload?.dateStart as string | undefined;
      const dateEnd = payload?.dateEnd as string | undefined;

      // Paginate internally to bypass the 1000-row cap
      const BATCH = 1000;
      const HARD_CAP = 50000; // safety cap
      const all: any[] = [];
      let from = 0;
      while (from < HARD_CAP) {
        let q = adminClient
          .from("orders")
          .select(`
            id, channel, status, delivery_date, delivery_time, created_at, fulfillment_type, payment_method, payment_method_2, payment_amount_1, payment_amount_2, change_for_2, is_split_payment, total_amount, change_for, rider_id, pix_paid, pix_paid_at, em_rota_at, notes, updated_at, updated_by, scheduled_date, scheduled_time, reminder_enabled, reminder_dismissed,
            customers(id, name, phone, cnpj, type),
            addresses(street, number, neighborhood, city, complement, reference),
            order_items(qty, product_id, products(name))
          `)
          .order("created_at", { ascending: false })
          .range(from, from + BATCH - 1);

        if (dateStart) q = q.gte("created_at", `${dateStart}T00:00:00`);
        if (dateEnd) q = q.lte("created_at", `${dateEnd}T23:59:59.999`);

        const { data, error } = await q;
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < BATCH) break;
        from += BATCH;
      }

      // Enrich with rider name
      const riderIds = [...new Set(all.map((o: any) => o.rider_id).filter(Boolean))];
      let ridersMap: Record<string, string> = {};
      if (riderIds.length > 0) {
        const { data: ridersData } = await adminClient.from("delivery_riders").select("id, name").in("id", riderIds);
        (ridersData || []).forEach((r: any) => { ridersMap[r.id] = r.name; });
      }
      const enriched = all.map((o: any) => ({ ...o, rider_name: o.rider_id ? ridersMap[o.rider_id] || "—" : undefined }));
      return json({ data: enriched });
    }

    if (action === "orders.update") {
      const orderId = payload?.orderId as string;
      if (!orderId) throw new Error("Pedido inválido.");

      const orderData = payload?.order || {};
      const items = payload?.items as { product_id: string; qty: number }[] | undefined;
      const address = payload?.address;

      // Update order fields
      const updateFields: any = { updated_at: new Date().toISOString(), updated_by: admin.username };
      const allowedFields = ["status", "notes", "delivery_date", "delivery_time", "fulfillment_type", "payment_method", "payment_method_2", "payment_amount_1", "payment_amount_2", "is_split_payment", "total_amount", "change_for", "change_for_2", "rider_id", "scheduled_date", "scheduled_time", "reminder_enabled", "reminder_dismissed"];
      for (const key of allowedFields) {
        if (key in orderData) updateFields[key] = orderData[key];
      }

      // Status change to em_rota: atomic stock deduction + status via RPC
      if (orderData.status === "em_rota") {
        const { data: results, error: rotaError } = await adminClient.rpc("mark_orders_em_rota", {
          p_order_ids: [orderId],
          p_created_by: admin.username,
        });
        if (rotaError) throw rotaError;
        const result = (results as { ok: boolean; error?: string }[] | null)?.[0];
        if (result && !result.ok) throw new Error(result.error || "Não foi possível colocar o pedido em rota.");
        delete updateFields.status;
      }

      const { error: updateErr } = await adminClient.from("orders").update(updateFields).eq("id", orderId);
      if (updateErr) throw updateErr;

      // Update items: DELETE + INSERT
      if (items && items.length > 0) {
        const { error: delErr } = await adminClient.from("order_items").delete().eq("order_id", orderId);
        if (delErr) throw delErr;
        const { error: insErr } = await adminClient.from("order_items").insert(
          items.map((i) => ({ order_id: orderId, product_id: i.product_id, qty: i.qty }))
        );
        if (insErr) throw insErr;
      }

      // Update / create address conforme o tipo de atendimento
      const fulfillmentType = orderData.fulfillment_type;

      if (fulfillmentType === "pickup") {
        // Virou Retirada: desvincula o endereço do pedido (não apaga o registro,
        // que pode estar ligado a um cliente cadastrado)
        const { error: unlinkErr } = await adminClient
          .from("orders")
          .update({ address_id: null })
          .eq("id", orderId);
        if (unlinkErr) throw unlinkErr;
      } else if (address && address.street && address.number) {
        // Entrega com endereço válido preenchido
        const { data: order } = await adminClient
          .from("orders")
          .select("address_id, customer_id")
          .eq("id", orderId)
          .single();

        if (order?.address_id) {
          // Pedido já possuía endereço: atualiza o registro existente
          const { error: addrErr } = await adminClient.from("addresses").update({
            street: address.street,
            number: address.number,
            neighborhood: address.neighborhood || "—",
            city: address.city || "Santo André",
            complement: address.complement || null,
            reference: address.reference || null,
          }).eq("id", order.address_id);
          if (addrErr) throw addrErr;
        } else {
          // Pedido não possuía endereço (era Retirada): cria um novo e vincula ao pedido
          const { data: newAddress, error: insertErr } = await adminClient
            .from("addresses")
            .insert({
              customer_id: order?.customer_id ?? null,
              street: address.street,
              number: address.number,
              neighborhood: address.neighborhood || "—",
              city: address.city || "Santo André",
              state: "SP",
              complement: address.complement || null,
              reference: address.reference || null,
            })
            .select("id")
            .single();
          if (insertErr) throw insertErr;

          const { error: linkErr } = await adminClient
            .from("orders")
            .update({ address_id: newAddress.id })
            .eq("id", orderId);
          if (linkErr) throw linkErr;
        }
      }

      return json({ ok: true });
    }

    if (action === "customers.delete") {
      const customerId = payload?.customerId as string;
      if (!customerId) throw new Error("ID do cliente é obrigatório.");

      // Check for linked orders
      const { count, error: countErr } = await adminClient
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", customerId);
      if (countErr) throw countErr;

      if ((count ?? 0) > 0) {
        return json({ error: "Este cliente possui pedidos registrados e não pode ser excluído. Remova os pedidos primeiro." }, 400);
      }

      // Delete addresses first
      const { error: addrErr } = await adminClient
        .from("addresses")
        .delete()
        .eq("customer_id", customerId);
      if (addrErr) throw addrErr;

      // Delete customer
      const { error: custErr } = await adminClient
        .from("customers")
        .delete()
        .eq("id", customerId);
      if (custErr) throw custErr;

      return json({ ok: true });
    }

    if (action === "customers.checkDuplicate") {
      const street = ((payload?.street as string) || "").trim();
      const number = ((payload?.number as string) || "").trim();
      const complement = ((payload?.complement as string) || "").trim();
      const excludeCustomerId = payload?.excludeCustomerId as string | undefined;

      if (!street || !number) return json({ data: null });

      // Normalize complement for comparison
      const normalizeComp = (val: string | null | undefined): string =>
        (val ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

      const normalizedComplement = normalizeComp(complement);

      // Fetch all addresses with same street+number, then filter by complement in code
      let query = adminClient
        .from("addresses")
        .select("id, customer_id, complement, customers(name)")
        .ilike("street", street)
        .eq("number", number)
        .limit(50);

      if (excludeCustomerId) {
        query = query.neq("customer_id", excludeCustomerId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Find match where complement also matches (both empty = match)
      const match = (data ?? []).find((row: { complement: string | null }) =>
        normalizeComp(row.complement) === normalizedComplement
      );

      return json({ data: match || null });
    }

    // ---- Riders ----
    if (action === "riders.list") {
      const { data, error } = await adminClient
        .from("delivery_riders")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return json({ data });
    }

    if (action === "riders.save") {
      const rider = payload as { id?: string; label: string; name: string; active?: boolean; sort_order?: number };
      if (!rider.label || !rider.name) throw new Error("Label e nome são obrigatórios.");
      if (rider.id) {
        const { error } = await adminClient.from("delivery_riders").update({
          label: rider.label, name: rider.name, active: rider.active ?? true, sort_order: rider.sort_order ?? 0,
        }).eq("id", rider.id);
        if (error) throw error;
      } else {
        const { error } = await adminClient.from("delivery_riders").insert({
          label: rider.label, name: rider.name, sort_order: rider.sort_order ?? 0,
        });
        if (error) throw error;
      }
      return json({ ok: true });
    }

    if (action === "orders.setRider") {
      const orderId = payload?.orderId as string;
      const riderId = payload?.riderId as string | null;
      if (!orderId) throw new Error("Pedido inválido.");
      const { error } = await adminClient.from("orders").update({ rider_id: riderId || null }).eq("id", orderId);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "riders.delete") {
      const riderId = payload?.riderId as string;
      if (!riderId) throw new Error("ID do motoboy é obrigatório.");

      // Check if rider has linked orders
      const { count, error: countErr } = await adminClient
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("rider_id", riderId);
      if (countErr) throw countErr;

      if ((count ?? 0) > 0) {
        // Unlink orders first, then delete
        const { error: unlinkErr } = await adminClient
          .from("orders")
          .update({ rider_id: null })
          .eq("rider_id", riderId);
        if (unlinkErr) throw unlinkErr;
      }

      const { error } = await adminClient.from("delivery_riders").delete().eq("id", riderId);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "orders.saveCustomerFromOrder") {
      const orderId = payload?.orderId as string;
      const customer = payload?.customer as { name: string; phone?: string; type?: "PF" | "PJ" };
      const address = payload?.address as { street: string; number: string; neighborhood: string; city?: string; complement?: string } | undefined;
      if (!orderId) throw new Error("Pedido inválido.");
      if (!customer?.name) throw new Error("Nome do cliente é obrigatório.");

      const phone = normalizePhone(customer.phone || "");

      // Create customer
      const { data: newCustomer, error: custErr } = await adminClient
        .from("customers")
        .insert({ name: customer.name, phone: phone || null, type: customer.type || "PF" })
        .select("id")
        .single();
      if (custErr) throw custErr;

      // Create address if provided
      let addressId: string | null = null;
      if (address?.street && address?.number) {
        const { data: addrRow, error: addrErr } = await adminClient
          .from("addresses")
          .insert({
            customer_id: newCustomer.id,
            street: address.street, number: address.number,
            neighborhood: address.neighborhood || "—",
            city: address.city || "Santo André", state: "SP",
            complement: address.complement || null,
            is_primary: true,
          })
          .select("id")
          .single();
        if (addrErr) throw addrErr;
        addressId = addrRow.id;
      }

      // Link customer to order
      const updateData: any = { customer_id: newCustomer.id };
      if (addressId) updateData.address_id = addressId;
      const { error: orderErr } = await adminClient.from("orders").update(updateData).eq("id", orderId);
      if (orderErr) throw orderErr;

      return json({ data: { customer_id: newCustomer.id } });
    }

    if (action === "riders.stats") {
      // Get stats for riders: count of orders and sum of items for delivered orders
      const riderIds = (payload?.riderIds || []) as string[];
      if (riderIds.length === 0) return json({ data: {} });

      const { data: orders, error } = await adminClient
        .from("orders")
        .select("rider_id, order_items(qty)")
        .in("rider_id", riderIds)
        .eq("status", "entregue");
      if (error) throw error;

      const stats: Record<string, { pedidos: number; galoes: number }> = {};
      for (const o of (orders || [])) {
        const rid = (o as any).rider_id;
        if (!rid) continue;
        if (!stats[rid]) stats[rid] = { pedidos: 0, galoes: 0 };
        stats[rid].pedidos++;
        stats[rid].galoes += ((o as any).order_items || []).reduce((s: number, i: any) => s + (i.qty || 0), 0);
      }
      return json({ data: stats });
    }

    if (action === "riders.dailyStats") {
      const riderIds = (payload?.riderIds || []) as string[];
      const dateFrom = (payload?.dateFrom as string) || "";
      if (riderIds.length === 0) return json({ data: {} });

      let query = adminClient
        .from("orders")
        .select("id, rider_id, created_at, order_items(qty, product_id, products(name, category_id, product_categories(name)))")
        .in("rider_id", riderIds);

      if (dateFrom) {
        query = query.gte("created_at", `${dateFrom}T00:00:00`);
      }

      const { data: orders, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;

      // Group by rider then by day, counting only galão items
      const result: Record<string, { dia: string; total_galoes: number; total_pedidos: number }[]> = {};
      const riderDayMap: Record<string, Record<string, { galoes: number; orderIds: Set<string> }>> = {};

      for (const o of (orders || []) as any[]) {
        const rid = o.rider_id;
        if (!rid) continue;
        const day = (o.created_at as string).substring(0, 10);
        if (!riderDayMap[rid]) riderDayMap[rid] = {};
        if (!riderDayMap[rid][day]) riderDayMap[rid][day] = { galoes: 0, orderIds: new Set() };

        riderDayMap[rid][day].orderIds.add(o.id || day);
        for (const item of (o.order_items || [])) {
          const catName = (item.products?.product_categories?.name || "").toLowerCase();
          // Count only galão category items
          if (catName.includes("gal")) {
            riderDayMap[rid][day].galoes += item.qty || 0;
          }
        }
      }

      for (const rid of Object.keys(riderDayMap)) {
        result[rid] = Object.entries(riderDayMap[rid])
          .map(([dia, v]) => ({ dia, total_galoes: v.galoes, total_pedidos: v.orderIds.size }))
          .sort((a, b) => b.dia.localeCompare(a.dia));
      }

      return json({ data: result });
    }

    if (action === "orders.togglePixPaid") {
      const orderId = payload?.orderId as string;
      if (!orderId) throw new Error("Pedido inválido.");
      const { data: order, error: fetchErr } = await adminClient
        .from("orders")
        .select("pix_paid")
        .eq("id", orderId)
        .single();
      if (fetchErr) throw fetchErr;
      const newVal = !order.pix_paid;
      const { error } = await adminClient
        .from("orders")
        .update({ pix_paid: newVal, pix_paid_at: newVal ? new Date().toISOString() : null })
        .eq("id", orderId);
      if (error) throw error;
      return json({ data: { pix_paid: newVal, pix_paid_at: newVal ? new Date().toISOString() : null } });
    }

    if (action === "orders.dismissReminders") {
      const orderIds = (payload?.orderIds || []) as string[];
      if (orderIds.length === 0) return json({ ok: true });
      const { error } = await adminClient
        .from("orders")
        .update({ reminder_dismissed: true })
        .in("id", orderIds);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "orders.bulkUpdate") {
      const orderIds = (payload?.orderIds || []) as string[];
      const updates = (payload?.updates || {}) as Record<string, unknown>;
      if (!Array.isArray(orderIds) || orderIds.length === 0) throw new Error("Nenhum pedido selecionado");
      if (orderIds.length > 500) throw new Error("Máximo de 500 pedidos por operação");

      const allowed: Record<string, unknown> = {};
      if (typeof updates.status === "string") allowed.status = updates.status;
      if (updates.rider_id === null || typeof updates.rider_id === "string") allowed.rider_id = updates.rider_id;
      if (updates.payment_method === null || typeof updates.payment_method === "string") allowed.payment_method = updates.payment_method;

      if (Object.keys(allowed).length === 0) throw new Error("Nenhum campo válido para atualizar");

      if (allowed.status === "em_rota") {
        // Atomic per order: stock deduction + status together; one failure
        // does not block the rest of the batch
        const { data: results, error: rotaError } = await adminClient.rpc("mark_orders_em_rota", {
          p_order_ids: orderIds,
          p_created_by: admin.username,
        });
        if (rotaError) throw rotaError;
        const failed = ((results as { order_id: string; ok: boolean; error?: string }[] | null) ?? [])
          .filter((r) => !r.ok)
          .map((r) => ({ id: r.order_id, error: r.error || "Erro desconhecido" }));
        delete allowed.status;
        if (Object.keys(allowed).length > 0) {
          const { error } = await adminClient.from("orders").update(allowed).in("id", orderIds);
          if (error) throw error;
        }
        return json({ data: { ok: failed.length === 0, count: orderIds.length - failed.length, failed } });
      }

      const { error } = await adminClient
        .from("orders")
        .update(allowed)
        .in("id", orderIds);
      if (error) throw error;
      return json({ data: { ok: true, count: orderIds.length } });
    }

    if (action === "orders.bulkDelete") {
      const orderIds = (payload?.orderIds || []) as string[];
      if (!Array.isArray(orderIds) || orderIds.length === 0) throw new Error("Nenhum pedido selecionado");
      if (orderIds.length > 500) throw new Error("Máximo de 500 pedidos por operação");

      const { data: rows } = await adminClient
        .from("orders")
        .select("id,status")
        .in("id", orderIds);
      const deletable = (rows ?? []).filter((r) => r.status !== "entregue").map((r) => r.id);
      const skipped = orderIds.length - deletable.length;

      if (deletable.length > 0) {
        await adminClient.from("order_items").delete().in("order_id", deletable);
        const { error } = await adminClient.from("orders").delete().in("id", deletable);
        if (error) throw error;
      }
      return json({ data: { ok: true, deleted: deletable.length, skipped } });
    }

    if (action === "export.table") {
      if (admin.role !== "admin_owner") {
        return json({ error: "Acesso negado." }, 403);
      }
      const allowedTables = [
        "addresses","admin_users","customers","delivery_riders","order_items",
        "orders","product_categories","products","stock_movements","user_roles",
        "wholesale_price_tiers",
      ];
      const table = payload?.table as string;
      if (!table || !allowedTables.includes(table)) {
        return json({ error: "Tabela inválida" }, 400);
      }
      const from = typeof payload?.from === "number" ? payload.from : 0;
      const rawLimit = typeof payload?.limit === "number" ? payload.limit : 1000;
      const limit = Math.min(Math.max(rawLimit, 1), 1000);
      const orderBy = typeof payload?.orderBy === "string" && payload.orderBy ? payload.orderBy : "id";
      const { data, error, count } = await adminClient
        .from(table)
        .select("*", { count: "exact" })
        .order(orderBy, { ascending: true })
        .range(from, from + limit - 1);
      if (error) throw error;
      return json({ data: { rows: data, total: count } });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (error) {
    console.error("admin-panel error", error);

    // P0001 = RAISE EXCEPTION nas funções do banco: mensagens de negócio
    // escritas para o usuário (ex.: estoque insuficiente), não vazam internals
    const errorCode = (error as { code?: string })?.code;
    const isAppError =
      error instanceof Error &&
      (!errorCode || errorCode === "P0001") &&
      !error.message.includes("violates") &&
      !error.message.includes("constraint");

    const message = isAppError
      ? error.message
      : "Erro interno ao processar a requisição.";

    return json({ error: message }, 400);
  }
});
