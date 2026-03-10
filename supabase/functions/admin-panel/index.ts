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
      const { data, error } = await adminClient
        .from("orders")
        .select(`
          id, channel, delivery_date, delivery_time, status, notes, created_at,
          customers(id, name, phone, cnpj),
          addresses(street, number, neighborhood, city, complement),
          order_items(qty, products(name))
        `)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return json({ data });
    }

    if (action === "orders.updateStatus") {
      const orderId = payload?.orderId as string;
      const newStatus = payload?.status as string;
      if (!orderId || !newStatus) throw new Error("Pedido/status inválido");

      const { data: currentOrder, error: currentError } = await adminClient
        .from("orders")
        .select("status")
        .eq("id", orderId)
        .single();

      if (currentError) throw currentError;

      if (newStatus === "em_rota" && currentOrder.status !== "em_rota") {
        const { error: stockError } = await adminClient.rpc("deduct_stock_for_order", {
          p_order_id: orderId,
          p_created_by: admin.username,
        });
        if (stockError) throw stockError;
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

      if (!customer?.name || !customer?.phone || !address?.street || !address?.number || !address?.neighborhood) {
        throw new Error("Preencha os campos obrigatórios do cliente e endereço.");
      }

      if (!Array.isArray(items) || items.length === 0) {
        throw new Error("Selecione ao menos um produto.");
      }

      const customerRow = await upsertCustomerByPhone({
        name: customer.name,
        phone: customer.phone,
        type: customer.type,
        cnpj: customer.cnpj,
        email: customer.email,
      });

      const { data: addressRow, error: addressError } = await adminClient
        .from("addresses")
        .insert({
          customer_id: customerRow.id,
          street: address.street,
          number: address.number,
          neighborhood: address.neighborhood,
          city: address.city || "Santo André",
          state: address.state || "SP",
          complement: address.complement || null,
          zip: address.zip || null,
          is_primary: true,
        })
        .select("id")
        .single();

      if (addressError) throw addressError;

      const { data: order, error: orderError } = await adminClient
        .from("orders")
        .insert({
          channel,
          customer_id: customerRow.id,
          address_id: addressRow.id,
          notes: payload?.notes || null,
          delivery_date: payload?.delivery_date || null,
          delivery_time: payload?.delivery_time || null,
          status: "novo",
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

      return json({ data: { order_id: order.id, customer_id: customerRow.id } });
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
      const data = await upsertCustomerByPhone({
        id: payload?.id,
        name: payload?.name,
        phone: payload?.phone,
        type: payload?.type,
        cnpj: payload?.cnpj,
        email: payload?.email,
      });

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

      const { data, error } = await adminClient
        .from("customers")
        .select("id, name, phone, type, cnpj, email, addresses(street, number, neighborhood, city, state, complement, zip, reference, is_primary)")
        .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
        .order("name")
        .limit(10);
      if (error) throw error;
      return json({ data });
    }

    if (action === "products.list") {
      const [{ data: products, error: prodError }, { data: tiers, error: tierError }] = await Promise.all([
        adminClient.from("products").select("*").order("created_at"),
        adminClient.from("wholesale_price_tiers").select("*").order("min_qty"),
      ]);
      if (prodError) throw prodError;
      if (tierError) throw tierError;
      return json({ data: { products, tiers } });
    }

    if (action === "products.save") {
      const product = payload?.product;
      const tiers = (payload?.tiers || []) as { min_qty: number; price_text: string }[];
      if (!product?.name) throw new Error("Nome do produto é obrigatório.");

      const productData = {
        name: product.name,
        description: product.description || null,
        type: product.type,
        icon: product.icon || null,
        active: product.active,
        price_text: product.price_text || null,
        track_stock: !!product.track_stock,
        min_stock_qty: product.min_stock_qty || 0,
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

    if (action === "reports.orders") {
      if (admin.role !== "admin_owner") {
        return json({ error: "Acesso negado. Apenas o proprietário pode acessar relatórios." }, 403);
      }
      const { data, error } = await adminClient
        .from("orders")
        .select("id, channel, status, delivery_date, created_at, customers(name), order_items(qty, products(name))")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return json({ data });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (error) {
    console.error("admin-panel error", error);

    // Only surface messages we explicitly threw; hide raw DB errors
    const isAppError =
      error instanceof Error &&
      !(error as any).code && // Postgres errors have a .code property
      !error.message.includes("violates") &&
      !error.message.includes("constraint");

    const message = isAppError
      ? error.message
      : "Erro interno ao processar a requisição.";

    return json({ error: message }, 400);
  }
});
