import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { buildNfePayload, checkNfe, describeNfeError, isStillProcessing, nfeFixes, type NfeInput } from "../_shared/nfe.ts";

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

function digitsOrNull(value: unknown): string | null {
  const digits = typeof value === "string" ? value.replace(/\D/g, "") : "";
  return digits || null;
}

// Dados fiscais do cliente. Só entram os campos que vieram no payload, para
// que telas que não conhecem esses campos (o Novo pedido) não apaguem nada.
function customerFiscalFields(payload: Record<string, unknown>, type: "PF" | "PJ") {
  const fields: Record<string, unknown> = {};
  if ("cpf" in payload) fields.cpf = type === "PF" ? digitsOrNull(payload.cpf) : null;
  if ("ie" in payload) fields.ie = type === "PJ" ? digitsOrNull(payload.ie) : null;
  if ("ie_indicator" in payload) {
    const indicator = Number(payload.ie_indicator);
    fields.ie_indicator = type === "PJ" && [1, 2, 9].includes(indicator) ? indicator : null;
  }
  if ("legal_name" in payload) fields.legal_name = String(payload.legal_name ?? "").trim().slice(0, 150) || null;
  if ("notes" in payload) fields.notes = String(payload.notes ?? "").trim().slice(0, 2000) || null;
  return fields;
}

// Preço unitário do item. Vazio vira null, e o banco completa com o preço do
// produto (trigger order_items_default_price).
function toUnitPrice(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error("Preço do item inválido.");
  return Math.round(n * 100) / 100;
}

function formatCnpj(digits: string): string {
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

type ImportRow = {
  name?: string; legal_name?: string; notes?: string; type?: string; ie_exempt?: boolean;
  phone?: string; cpf?: string; cnpj?: string; ie?: string; email?: string;
  address?: {
    street?: string; number?: string; neighborhood?: string; city?: string; state?: string;
    zip?: string; complement?: string; reference?: string;
  };
};

type ImportResult = {
  index: number;
  action: "insert" | "update" | "skip";
  name?: string;
  address?: "nova" | "adicional" | "existente" | "sem";
  reason?: string;
};

// Normaliza uma linha da planilha. CPF e CNPJ são reconhecidos pelo tamanho,
// não pela coluna, porque muita planilha traz os dois numa coluna só.
function normalizeImportRow(row: ImportRow) {
  const text = (v: unknown, max = 200) => (typeof v === "string" || typeof v === "number" ? String(v).trim().slice(0, max) : "");
  let phone = text(row.phone, 30).replace(/\D/g, "");
  if (phone.length >= 12 && phone.startsWith("55")) phone = phone.slice(2);

  let cpf: string | null = null;
  let cnpj: string | null = null;
  for (const doc of [row.cpf, row.cnpj]) {
    const d = text(doc, 30).replace(/\D/g, "");
    if (d.length === 11 && !cpf) cpf = d;
    if (d.length === 14 && !cnpj) cnpj = d;
  }

  const a = row.address ?? {};
  const street = text(a.street);
  const number = text(a.number, 20);
  const zip = text(a.zip, 10).replace(/\D/g, "");

  // IE só com dígitos; "ISENTO" ou isento marcado vira indicador 2.
  // IE preenchida é contribuinte (1). Empresa sem IE e sem isenção fica sem
  // indicador, e a conferência da nota pede para completar.
  // "6,26714E+11" é IE que o Excel transformou em número e cortou: descarta.
  const ieText = text(row.ie, 20);
  const ie = /e\+/i.test(ieText) ? null : ieText.replace(/\D/g, "") || null;
  const ieIndicator = row.ie_exempt === true || /isent/i.test(ieText) ? 2
    : ie || row.ie_exempt === false ? 1
    : null;

  return {
    name: text(row.name, 100),
    legalName: text(row.legal_name, 150) || null,
    notes: text(row.notes, 2000) || null,
    type: row.type === "PJ" ? "PJ" : row.type === "PF" ? "PF" : null,
    phone: phone || null,
    cpf,
    cnpj,
    ie,
    ieIndicator,
    email: text(row.email, 100).toLowerCase() || null,
    address: street && number ? {
      street,
      number,
      neighborhood: text(a.neighborhood, 100),
      city: text(a.city, 100),
      state: text(a.state, 2).toUpperCase(),
      zip: zip.length === 8 ? zip : null,
      complement: text(a.complement) || null,
      reference: text(a.reference) || null,
    } : null,
  };
}

// ---- Nota fiscal (Brasil NFe) ----
// Ambiente fica em homologação (2, sem valor fiscal) até o secret NFE_AMBIENTE
// ser trocado para 1 de propósito, depois dos testes aprovados pelo contador.
const BRASILNFE_TOKEN = Deno.env.get("BRASILNFE_TOKEN") ?? "";
const NFE_AMBIENTE: 1 | 2 = Deno.env.get("NFE_AMBIENTE") === "1" ? 1 : 2;
const BRASILNFE_URL = "https://api.brasilnfe.com.br/services/Fiscal/";

class BrasilNfeOffline extends Error {}

async function brasilNfe<T>(method: string, body: unknown): Promise<T> {
  if (!BRASILNFE_TOKEN) {
    throw new Error("A emissão de nota ainda não foi configurada: falta o token da Brasil NFe.");
  }
  let res: Response;
  try {
    res = await fetch(BRASILNFE_URL + method, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Token: BRASILNFE_TOKEN },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    console.error("brasilnfe offline", method, err);
    throw new BrasilNfeOffline("A Brasil NFe não respondeu.");
  }
  const text = await res.text();
  let data: unknown = text;
  try { data = JSON.parse(text); } catch { /* resposta em texto puro */ }
  if (!res.ok) {
    console.error("brasilnfe http", method, res.status, text.slice(0, 500));
    const detail = typeof data === "object" && data ? describeNfeError(data as Record<string, never>) : String(text).slice(0, 300);
    throw new Error(`Brasil NFe recusou a requisição (${res.status}): ${detail}`);
  }
  return data as T;
}

function decodeBase64Utf8(b64: string): string {
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

async function lookupIbge(zip: string): Promise<string | null> {
  try {
    const res = await fetch(`https://viacep.com.br/ws/${zip}/json/`, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.ibge ? String(data.ibge) : null;
  } catch {
    return null;
  }
}

// Junta pedido, cliente, endereço e produtos no formato do montador da nota.
// Retirada usa o endereço principal do cliente. Endereço com CEP e sem código
// IBGE ganha o código aqui (ViaCEP) e fica salvo para a próxima vez.
async function loadNfeInput(orderId: string): Promise<NfeInput> {
  const { data: o, error } = await adminClient
    .from("orders")
    .select(`
      id, channel, fulfillment_type, total_amount, payment_method, payment_method_2, payment_amount_1,
      payment_amount_2, is_split_payment, payment_due_date, paid_at,
      customers(id, name, legal_name, type, cpf, cnpj, ie, ie_indicator, email, phone,
        addresses(id, street, number, neighborhood, city, state, zip, complement, ibge_code, is_primary)),
      addresses(id, street, number, neighborhood, city, state, zip, complement, ibge_code),
      order_items(qty, unit_price, product_id, products(name, ncm, cest, cfop, cst_csosn, pis_cofins_cst, origem, unidade, tax_group))
    `)
    .eq("id", orderId)
    .single();
  if (error) throw error;
  const order = o as any;
  const c = order.customers;
  const addr = order.addresses
    ?? c?.addresses?.find((a: any) => a.is_primary)
    ?? c?.addresses?.[0]
    ?? null;
  // Pedido antigo, com endereço sem CEP: usa o CEP do mesmo endereço no
  // cadastro do cliente, se existir.
  if (addr && !digitsOrNull(addr.zip)) {
    const twin = c?.addresses?.find((a: any) =>
      digitsOrNull(a.zip) && normalizeSearch(a.street || "") === normalizeSearch(addr.street || "") &&
      String(a.number || "").trim() === String(addr.number || "").trim());
    if (twin) {
      addr.zip = twin.zip;
      addr.ibge_code = addr.ibge_code || twin.ibge_code;
    }
  }

  if (addr && !addr.ibge_code && digitsOrNull(addr.zip)?.length === 8) {
    addr.ibge_code = await lookupIbge(digitsOrNull(addr.zip)!);
    if (addr.ibge_code) await adminClient.from("addresses").update({ ibge_code: addr.ibge_code }).eq("id", addr.id);
  }

  return {
    orderId: order.id,
    customerId: c?.id ?? null,
    addressId: addr?.id ?? null,
    channel: order.channel,
    fulfillmentType: order.fulfillment_type,
    totalAmount: order.total_amount,
    payment: {
      method: order.payment_method,
      method2: order.payment_method_2,
      amount1: order.payment_amount_1,
      amount2: order.payment_amount_2,
      isSplit: !!order.is_split_payment,
      dueDate: order.payment_due_date,
      paidAt: order.paid_at,
    },
    customer: c ? {
      name: c.name, legalName: c.legal_name, type: c.type, cpf: c.cpf, cnpj: c.cnpj, ie: c.ie,
      ieIndicator: c.ie_indicator, email: c.email, phone: c.phone,
    } : null,
    address: addr ? {
      street: addr.street, number: addr.number, neighborhood: addr.neighborhood, city: addr.city,
      state: addr.state, zip: addr.zip, complement: addr.complement, ibge: addr.ibge_code,
    } : null,
    items: (order.order_items ?? []).map((i: any) => ({
      productId: i.product_id,
      name: i.products?.name ?? "Produto",
      qty: i.qty,
      unitPrice: i.unit_price,
      ncm: i.products?.ncm ?? null,
      cest: i.products?.cest ?? null,
      cfop: i.products?.cfop ?? null,
      cstCsosn: i.products?.cst_csosn ?? null,
      pisCofinsCst: i.products?.pis_cofins_cst ?? null,
      origem: i.products?.origem ?? 0,
      unidade: i.products?.unidade ?? "UN",
      taxGroup: i.products?.tax_group ?? null,
    })),
  };
}

type NfeResponse = {
  ReturnNF?: {
    Numero?: number; Serie?: number; ChaveNF?: string; NumeroProtocolo?: string;
    CodStatusRespostaSefaz?: number; DsStatusRespostaSefaz?: string; Ok?: boolean;
  };
  Base64Xml?: string;
  Error?: string;
  Avisos?: string[];
  erros?: { codigo?: string; descricao?: string; correcao?: string }[];
};

type NfeEvent = { Status?: number; DsMotivo?: string; Error?: string; CodStatusRespostaSefaz?: number };

const INVOICE_COLUMNS = "id, order_id, environment, status, numero, serie, chave, protocolo, sefaz_code, message, total, correction_seq, created_at, updated_at, authorized_at, cancelled_at";

async function updateInvoice(id: string, patch: Record<string, unknown>) {
  const { data, error } = await adminClient
    .from("invoices")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(INVOICE_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

async function getInvoice(id: string) {
  const { data, error } = await adminClient.from("invoices").select("*").eq("id", id).single();
  if (error) throw error;
  return data as any;
}

function normalizeSearch(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

// A function roda em UTC. Vencimento e recebimento são sempre no dia de São Paulo.
function todayInSaoPaulo(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// Vírgula e parênteses quebram a sintaxe do or() do PostgREST.
function sanitizeSearch(input: unknown): string {
  return typeof input === "string"
    ? input.replace(/[,()*%]/g, " ").trim().slice(0, 60)
    : "";
}

const PAYMENT_METHODS = ["cash", "pix", "card"];

function toAmount(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} inválido.`);
  return n > 0 ? n : null;
}

// Normaliza o bloco de pagamento de um pedido. Passa por aqui tanto a edição
// completa quanto a troca avulsa da forma de pagamento, para que um pedido
// nunca fique meio dividido e meio simples no banco — que era a origem das
// divergências no relatório de caixa.
function normalizePaymentUpdate(input: Record<string, unknown>) {
  const method = input.payment_method ? String(input.payment_method) : null;
  const method2 = input.payment_method_2 ? String(input.payment_method_2) : null;
  const isSplit = input.is_split_payment === true;

  if (method && !PAYMENT_METHODS.includes(method)) throw new Error("Forma de pagamento inválida.");
  if (method2 && !PAYMENT_METHODS.includes(method2)) throw new Error("Segunda forma de pagamento inválida.");

  const total = toAmount(input.total_amount, "Valor total");
  const change1 = toAmount(input.change_for, "Troco");
  const change2 = toAmount(input.change_for_2, "Troco da segunda forma");

  if (!isSplit) {
    return {
      payment_method: method,
      payment_method_2: null,
      payment_amount_1: null,
      payment_amount_2: null,
      total_amount: total,
      change_for: method === "cash" ? change1 : null,
      change_for_2: null,
      is_split_payment: false,
    };
  }

  if (!method || !method2) throw new Error("Pagamento dividido exige as duas formas de pagamento.");
  if (method === method2) throw new Error("As duas formas de pagamento devem ser diferentes.");

  const amt1 = toAmount(input.payment_amount_1, "Valor da primeira forma");
  const amt2 = toAmount(input.payment_amount_2, "Valor da segunda forma");
  if (!amt1 || !amt2) throw new Error("Informe o valor de cada forma de pagamento.");
  if (total !== null && Math.abs(amt1 + amt2 - total) > 0.01) {
    throw new Error("A soma das duas formas deve ser igual ao total do pedido.");
  }

  return {
    payment_method: method,
    payment_method_2: method2,
    payment_amount_1: amt1,
    payment_amount_2: amt2,
    total_amount: total ?? amt1 + amt2,
    change_for: method === "cash" ? change1 : null,
    change_for_2: method2 === "cash" ? change2 : null,
    is_split_payment: true,
  };
}

// Saiu o PIX do pedido, sai junto a marcação de PIX pago: senão o badge fica
// verde num pedido que agora é dinheiro.
function pixResetFields(fields: { payment_method: string | null; payment_method_2: string | null }) {
  const hasPix = fields.payment_method === "pix" || fields.payment_method_2 === "pix";
  return hasPix ? {} : { pix_paid: false, pix_paid_at: null };
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
}, fiscal: Record<string, unknown> = {}) {
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
        ...fiscal,
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
        ...fiscal,
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
      ...fiscal,
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
          id, channel, delivery_date, delivery_time, status, notes, created_at, fulfillment_type, payment_method, payment_method_2, payment_amount_1, payment_amount_2, change_for_2, is_split_payment, total_amount, change_for, rider_id, pix_paid, pix_paid_at, em_rota_at, updated_at, updated_by, scheduled_date, scheduled_time, reminder_enabled, reminder_dismissed, payment_due_date, paid_at, paid_by,
          customers(id, name, phone, cnpj, type),
          addresses(street, number, neighborhood, city, complement, reference, zip, ibge_code),
          order_items(qty, product_id, unit_price, products(name)),
          invoices(id, status, numero, serie, environment, message, created_at)
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
      const items = payload?.items as { product_id: string; qty: number; unit_price?: number | null }[];
      const fulfillmentType = payload?.fulfillment_type || "delivery";
      const paymentMethod = payload?.payment_method || null;
      const paymentMethod2 = payload?.payment_method_2 || null;
      const paymentAmount1 = payload?.payment_amount_1 ?? null;
      const paymentAmount2 = payload?.payment_amount_2 ?? null;
      const isSplitPayment = !!payload?.is_split_payment;
      const totalAmount = payload?.total_amount ?? null;
      const changeFor = payload?.change_for ?? null;
      const changeFor2 = payload?.change_for_2 ?? null;
      const paymentDueDate = payload?.payment_due_date || null;

      if (paymentDueDate && !isValidDate(paymentDueDate)) {
        throw new Error("Data de vencimento inválida.");
      }

      if (!Array.isArray(items) || items.length === 0) {
        throw new Error("Selecione ao menos um produto.");
      }
      const itemPrices = items.map((item) => toUnitPrice(item.unit_price));

      let customerId: string | null = null;
      let addressId: string | null = null;

      // Cliente escolhido na busca entra pelo id: cliente sem telefone (comum
      // em loja de shopping) também fica vinculado ao pedido. O endereço
      // escolhido é reaproveitado; endereço digitado vira um novo do cliente.
      if (payload?.customer_id) {
        const { data: existingCustomer, error: custErr } = await adminClient
          .from("customers")
          .select("id, addresses(id)")
          .eq("id", payload.customer_id)
          .single();
        if (custErr || !existingCustomer) throw new Error("Cliente não encontrado.");
        customerId = existingCustomer.id;
        const ownAddresses = (existingCustomer.addresses ?? []) as { id: string }[];

        if (fulfillmentType === "delivery") {
          if (payload?.address_id && ownAddresses.some((a) => a.id === payload.address_id)) {
            addressId = payload.address_id;
            const fill: Record<string, unknown> = {};
            if (digitsOrNull(address?.zip)) fill.zip = digitsOrNull(address?.zip);
            if (digitsOrNull(address?.ibge_code)) fill.ibge_code = digitsOrNull(address?.ibge_code);
            if (Object.keys(fill).length) await adminClient.from("addresses").update(fill).eq("id", addressId);
          } else if (address?.street && address?.number) {
            const { data: addressRow, error: addressError } = await adminClient
              .from("addresses")
              .insert({
                customer_id: customerId,
                street: address.street,
                number: address.number,
                neighborhood: address.neighborhood || "—",
                city: address.city || "Santo André",
                state: address.state || "SP",
                complement: address.complement || null,
                zip: digitsOrNull(address.zip),
                ibge_code: digitsOrNull(address.ibge_code),
                is_primary: ownAddresses.length === 0,
              })
              .select("id")
              .single();
            if (addressError) throw addressError;
            addressId = addressRow.id;
          }
        }
      } else if (customer?.name && customer?.phone) {
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
              zip: digitsOrNull(address.zip),
              ibge_code: digitsOrNull(address.ibge_code),
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
            zip: digitsOrNull(address.zip),
            ibge_code: digitsOrNull(address.ibge_code),
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
          payment_due_date: paymentDueDate,
        })
        .select("id")
        .single();

      if (orderError) throw orderError;

      const { error: itemsError } = await adminClient.from("order_items").insert(
        items.map((item, i) => ({
          order_id: order.id,
          product_id: item.product_id,
          qty: item.qty,
          unit_price: itemPrices[i],
        })),
      );

      if (itemsError) throw itemsError;

      return json({ data: { order_id: order.id, customer_id: customerId } });
    }

    // ---- Contas a receber ----
    // Conta a receber = pedido com vencimento definido e ainda não recebido.
    // O pedido segue seu fluxo normal de entrega; só o dinheiro fica pendente.

    if (action === "receivables.list") {
      const view = payload?.view === "paid" ? "paid" : "open";
      const page = Math.max(0, Number(payload?.page ?? 0) | 0);
      const pageSize = Math.min(200, Math.max(1, Number(payload?.pageSize ?? 50) | 0));
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const today = todayInSaoPaulo();

      const dateStart = isValidDate(payload?.dateStart) ? payload.dateStart : null;
      const dateEnd = isValidDate(payload?.dateEnd) ? payload.dateEnd : null;
      const search = sanitizeSearch(payload?.search);

      // Com busca o join precisa ser inner, senão o pedido entra na lista
      // mesmo quando o cliente não bate com o termo.
      const customersEmbed = search
        ? "customers!inner(id, name, phone, cnpj, type)"
        : "customers(id, name, phone, cnpj, type)";

      let query = adminClient
        .from("orders")
        .select(`
          id, status, channel, created_at, delivery_date, delivery_time, fulfillment_type,
          scheduled_date, scheduled_time, total_amount, payment_method, payment_method_2,
          payment_amount_1, payment_amount_2, is_split_payment, change_for, change_for_2,
          payment_due_date, paid_at, paid_by, notes, updated_at, updated_by,
          ${customersEmbed},
          addresses(street, number, neighborhood, city, complement, reference),
          order_items(qty, product_id, products(name))
        `, { count: "exact" })
        .neq("status", "cancelado")
        .not("payment_due_date", "is", null);

      if (search) {
        const digits = search.replace(/\D/g, "");
        const terms = [`name.ilike.%${search}%`];
        terms.push(digits.length >= 3 ? `phone.ilike.%${digits}%` : `phone.ilike.%${search}%`);
        query = query.or(terms.join(","), { foreignTable: "customers" });
      }

      if (view === "paid") {
        query = query.not("paid_at", "is", null).order("paid_at", { ascending: false });
        if (dateStart) query = query.gte("paid_at", dateStart);
        if (dateEnd) query = query.lte("paid_at", dateEnd);
      } else {
        query = query.is("paid_at", null).order("payment_due_date", { ascending: true });
      }

      const { data, error, count } = await query.range(from, to);
      if (error) throw error;

      const { data: summaryRows, error: summaryError } = await adminClient.rpc("get_receivables_summary", {
        date_start: dateStart,
        date_end: dateEnd,
        search: search || null,
      });
      if (summaryError) throw summaryError;

      const raw = (summaryRows as any[] | null)?.[0] ?? {};
      const summary = {
        open_total: Number(raw.open_total ?? 0),
        open_count: Number(raw.open_count ?? 0),
        due_today_total: Number(raw.due_today_total ?? 0),
        due_today_count: Number(raw.due_today_count ?? 0),
        late_total: Number(raw.late_total ?? 0),
        late_count: Number(raw.late_count ?? 0),
        received_total: Number(raw.received_total ?? 0),
        received_count: Number(raw.received_count ?? 0),
      };

      return json({ data: { rows: data || [], total: count ?? 0, page, pageSize, today, summary } });
    }

    if (action === "receivables.markPaid") {
      const orderId = payload?.orderId as string;
      if (!orderId) throw new Error("Pedido inválido.");

      const paidAt = payload?.paidAt || todayInSaoPaulo();
      if (!isValidDate(paidAt)) throw new Error("Data do recebimento inválida.");

      const { data: order, error: fetchError } = await adminClient
        .from("orders")
        .select("id, status, total_amount, payment_due_date, paid_at, payment_method, is_split_payment")
        .eq("id", orderId)
        .maybeSingle();
      if (fetchError) throw fetchError;

      if (!order) throw new Error("Pedido não encontrado.");
      if (order.status === "cancelado") throw new Error("Pedido cancelado não pode ser recebido.");
      if (!order.payment_due_date) throw new Error("Este pedido não é a prazo. Defina o vencimento antes de dar baixa.");
      if (order.paid_at) throw new Error("Este pedido já foi recebido.");
      if (order.total_amount == null || Number(order.total_amount) <= 0) {
        throw new Error("Preencha o valor total do pedido antes de dar baixa.");
      }

      const updateFields: Record<string, unknown> = {
        paid_at: paidAt,
        paid_by: admin.username,
        updated_at: new Date().toISOString(),
        updated_by: admin.username,
      };

      // A baixa registra uma única forma de pagamento. Se o pedido estava
      // dividido, o split sai junto — senão o relatório de caixa continuaria
      // somando as duas parcelas antigas além do valor recebido agora.
      const method = payload?.paymentMethod as string | undefined;
      if (method) {
        if (!PAYMENT_METHODS.includes(method)) throw new Error("Forma de pagamento inválida.");
        Object.assign(updateFields, {
          payment_method: method,
          payment_method_2: null,
          payment_amount_1: null,
          payment_amount_2: null,
          change_for_2: null,
          is_split_payment: false,
        });
        if (method !== "pix") {
          updateFields.pix_paid = false;
          updateFields.pix_paid_at = null;
        }
      }

      const { error } = await adminClient.from("orders").update(updateFields).eq("id", orderId);
      if (error) throw error;

      return json({ data: { ok: true, paid_at: paidAt } });
    }

    if (action === "receivables.undoPaid") {
      const orderId = payload?.orderId as string;
      if (!orderId) throw new Error("Pedido inválido.");

      const { error } = await adminClient
        .from("orders")
        .update({
          paid_at: null,
          paid_by: null,
          updated_at: new Date().toISOString(),
          updated_by: admin.username,
        })
        .eq("id", orderId);
      if (error) throw error;

      return json({ data: { ok: true } });
    }

    if (action === "customers.list") {
      // A lista ia até 500 clientes e o PostgREST corta cada resposta em 1000.
      // Com a cartela da loja nova passa disso, então busca em páginas.
      const all: unknown[] = [];
      for (let from = 0; from < 10000; from += 1000) {
        const { data, error } = await adminClient
          .from("customers")
          .select("*, addresses(id, street, number, neighborhood, city, state, complement, zip, ibge_code, reference, is_primary)")
          .order("created_at", { ascending: false })
          .range(from, from + 999);
        if (error) throw error;
        all.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      return json({ data: all });
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
      const fiscal = customerFiscalFields(payload ?? {}, pType);

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
            ...fiscal,
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
        }, fiscal);
      } else {
        const { data: inserted, error } = await adminClient
          .from("customers")
          .insert({
            name,
            phone: null,
            type: pType,
            cnpj: pType === "PJ" ? payload?.cnpj || null : null,
            email: payload?.email || null,
            ...fiscal,
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
            ibge_code: digitsOrNull(addr.ibge_code),
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
            ibge_code: digitsOrNull(addr.ibge_code),
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
        .select("id, name, legal_name, notes, phone, type, cnpj, cpf, ie, ie_indicator, email, created_at, addresses(id, street, number, neighborhood, city, state, complement, zip, ibge_code, reference, is_primary)")
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
          .select("id, name, legal_name, notes, phone, type, cnpj, cpf, ie, ie_indicator, email, created_at, addresses(id, street, number, neighborhood, city, state, complement, zip, ibge_code, reference, is_primary)")
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

      // Preço e dados fiscais só entram quando vêm no payload: a segunda
      // chamada do upload de imagem não manda esses campos e não pode apagá-los.
      if ("price" in product) productData.price = toUnitPrice(product.price);
      for (const key of ["ncm", "cest", "cfop", "cst_csosn", "pis_cofins_cst"]) {
        if (key in product) productData[key] = digitsOrNull(product[key]);
      }
      if ("origem" in product) {
        const origem = Number(product.origem);
        productData.origem = Number.isInteger(origem) && origem >= 0 && origem <= 8 ? origem : 0;
      }
      if ("tax_group" in product) productData.tax_group = String(product.tax_group || "").trim().slice(0, 40) || null;
      if ("unidade" in product) {
        productData.unidade = String(product.unidade || "").trim().toUpperCase().slice(0, 6) || "UN";
      }

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

    if (action === "reports.cash") {
      if (admin.role !== "admin_owner") {
        return json({ error: "Acesso negado. Apenas o proprietário pode acessar relatórios." }, 403);
      }

      const dateStart = payload?.dateStart as string;
      const dateEnd = payload?.dateEnd as string;
      if (!isValidDate(dateStart) || !isValidDate(dateEnd)) throw new Error("Período inválido.");

      const search = sanitizeSearch(payload?.search);
      const page = Math.max(0, Number(payload?.page ?? 0) | 0);
      const pageSize = Math.min(200, Math.max(1, Number(payload?.pageSize ?? 50) | 0));

      const [methodsRes, entriesRes] = await Promise.all([
        adminClient.rpc("get_cash_by_payment_method", { date_start: dateStart, date_end: dateEnd }),
        adminClient.rpc("get_cash_entries", {
          date_start: dateStart,
          date_end: dateEnd,
          search: search || null,
          row_limit: pageSize,
          row_offset: page * pageSize,
        }),
      ]);

      if (methodsRes.error) throw methodsRes.error;
      if (entriesRes.error) throw entriesRes.error;

      const entries = (entriesRes.data || []) as any[];

      return json({
        data: {
          byMethod: ((methodsRes.data || []) as any[]).map((r) => ({
            payment_method: r.payment_method,
            a_prazo: !!r.a_prazo,
            total: Number(r.total ?? 0),
            order_count: Number(r.order_count ?? 0),
          })),
          entries: entries.map((r) => ({
            order_id: r.order_id,
            cash_date: r.cash_date,
            customer_name: r.customer_name,
            customer_phone: r.customer_phone,
            payment_method: r.payment_method,
            payment_method_2: r.payment_method_2,
            is_split: !!r.is_split,
            total_amount: Number(r.total_amount ?? 0),
            a_prazo: !!r.a_prazo,
            due_date: r.due_date,
          })),
          total: Number(entries[0]?.total_count ?? 0),
          page,
          pageSize,
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
            id, channel, status, delivery_date, delivery_time, created_at, fulfillment_type, payment_method, payment_method_2, payment_amount_1, payment_amount_2, change_for_2, is_split_payment, total_amount, change_for, rider_id, pix_paid, pix_paid_at, em_rota_at, notes, updated_at, updated_by, scheduled_date, scheduled_time, reminder_enabled, reminder_dismissed, payment_due_date, paid_at, paid_by,
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
      const items = payload?.items as { product_id: string; qty: number; unit_price?: number | null }[] | undefined;
      const address = payload?.address;
      const itemPrices = (items ?? []).map((i) => toUnitPrice(i.unit_price));

      // Update order fields
      const updateFields: any = { updated_at: new Date().toISOString(), updated_by: admin.username };
      const allowedFields = ["status", "notes", "delivery_date", "delivery_time", "fulfillment_type", "payment_method", "payment_method_2", "payment_amount_1", "payment_amount_2", "is_split_payment", "total_amount", "change_for", "change_for_2", "rider_id", "scheduled_date", "scheduled_time", "reminder_enabled", "reminder_dismissed", "payment_due_date"];
      for (const key of allowedFields) {
        if (key in orderData) updateFields[key] = orderData[key];
      }

      if ("payment_due_date" in updateFields) {
        const due = updateFields.payment_due_date;
        if (!due) updateFields.payment_due_date = null;
        else if (!isValidDate(due)) throw new Error("Data de vencimento inválida.");
      }

      // O formulário de edição manda o bloco de pagamento inteiro (com
      // is_split_payment). Normaliza tudo junto para não deixar sobra de um
      // pagamento dividido anterior.
      if ("is_split_payment" in orderData) {
        const payment = normalizePaymentUpdate(orderData);
        Object.assign(updateFields, payment, pixResetFields(payment));
      } else if (orderData.payment_method && !PAYMENT_METHODS.includes(String(orderData.payment_method))) {
        throw new Error("Forma de pagamento inválida.");
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

      // Update items: DELETE + INSERT. Item sem preço informado mantém o preço
      // que já tinha neste pedido, para a edição não trocar pelo preço de hoje.
      if (items && items.length > 0) {
        const { data: currentItems, error: curErr } = await adminClient
          .from("order_items")
          .select("product_id, unit_price")
          .eq("order_id", orderId);
        if (curErr) throw curErr;
        const previousPrice = new Map<string, number | null>(
          (currentItems ?? []).map((i: { product_id: string; unit_price: number | null }) => [i.product_id, i.unit_price]),
        );

        const { error: delErr } = await adminClient.from("order_items").delete().eq("order_id", orderId);
        if (delErr) throw delErr;
        const { error: insErr } = await adminClient.from("order_items").insert(
          items.map((i, idx) => ({
            order_id: orderId,
            product_id: i.product_id,
            qty: i.qty,
            unit_price: itemPrices[idx] ?? previousPrice.get(i.product_id) ?? null,
          }))
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
            ...("zip" in address ? { zip: digitsOrNull(address.zip), ibge_code: digitsOrNull(address.ibge_code) } : {}),
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
              zip: digitsOrNull(address.zip),
              ibge_code: digitsOrNull(address.ibge_code),
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

    // ---- Importação de clientes por planilha ----
    // Recebe um lote de linhas já mapeadas no navegador. Quem tem CPF/CNPJ é
    // achado só pelo documento. Sem documento, telefone só identifica se o nome
    // também bate: no Disk, lojas diferentes dividem o telefone do gerente.
    // Sem documento e sem telefone, vale o nome exato. Cliente achado só ganha
    // o que está vazio no cadastro. dryRun devolve o que aconteceria sem gravar.
    if (action === "customers.import") {
      const dryRun = payload?.dryRun === true;
      const rows = (payload?.rows || []) as ImportRow[];
      if (!Array.isArray(rows)) throw new Error("Linhas inválidas.");
      if (rows.length > 200) throw new Error("Envie no máximo 200 linhas por vez.");

      const clean = rows.map(normalizeImportRow);
      const phones = [...new Set(clean.map((r) => r.phone).filter(Boolean))] as string[];
      const cpfs = [...new Set(clean.map((r) => r.cpf).filter(Boolean))] as string[];
      const cnpjDigits = [...new Set(clean.map((r) => r.cnpj).filter(Boolean))] as string[];
      const bareNames = [...new Set(clean.filter((r) => !r.cpf && !r.cnpj && !r.phone && r.name).map((r) => r.name))];

      type Existing = {
        id: string; name: string; legal_name: string | null; notes: string | null; phone: string | null;
        type: "PF" | "PJ"; cpf: string | null; cnpj: string | null; ie: string | null; ie_indicator: number | null;
        email: string | null; addresses: { id: string; street: string; number: string; zip: string | null }[];
      };
      const columns = "id, name, legal_name, notes, phone, type, cpf, cnpj, ie, ie_indicator, email, addresses(id, street, number, zip)";

      // O cadastro guarda CNPJ com máscara (é o que o painel manda), mas
      // pode haver registro só com dígitos. Busca pelas duas formas.
      const filters: string[] = [];
      if (phones.length) filters.push(`phone.in.(${phones.join(",")})`);
      if (cpfs.length) filters.push(`cpf.in.(${cpfs.join(",")})`);
      if (cnpjDigits.length) {
        const forms = cnpjDigits.flatMap((d) => [d, formatCnpj(d)]).map((c) => `"${c}"`);
        filters.push(`cnpj.in.(${forms.join(",")})`);
      }
      const existing: Existing[] = [];
      if (filters.length) {
        const { data, error } = await adminClient.from("customers").select(columns).or(filters.join(","));
        if (error) throw error;
        existing.push(...((data ?? []) as Existing[]));
      }
      if (bareNames.length) {
        const { data, error } = await adminClient.from("customers").select(columns).in("name", bareNames);
        if (error) throw error;
        for (const c of (data ?? []) as Existing[]) if (!existing.some((e) => e.id === c.id)) existing.push(c);
      }

      const byCpf = new Map(existing.filter((c) => c.cpf).map((c) => [c.cpf as string, c]));
      const byCnpj = new Map(existing.filter((c) => c.cnpj).map((c) => [String(c.cnpj).replace(/\D/g, ""), c]));
      const sameName = (a: string, b: string) => {
        const x = normalizeSearch(a);
        const y = normalizeSearch(b);
        return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
      };
      const claimed = new Set<string>();
      const findMatch = (r: ReturnType<typeof normalizeImportRow>) => {
        const byDoc = (r.cpf && byCpf.get(r.cpf)) || (r.cnpj && byCnpj.get(r.cnpj)) || null;
        if (byDoc) return byDoc;
        // Sem documento igual, só aproveita cadastro que também não tem documento.
        const free = (c: Existing) => !claimed.has(c.id) && !c.cpf && !c.cnpj;
        if (r.phone) return existing.find((c) => free(c) && c.phone === r.phone && sameName(c.name, r.name)) ?? null;
        if (!r.cpf && !r.cnpj) return existing.find((c) => free(c) && !c.phone && normalizeSearch(c.name) === normalizeSearch(r.name)) ?? null;
        return null;
      };

      const sameStreet = (a: string, b: string) => normalizeSearch(a) === normalizeSearch(b);
      const results: ImportResult[] = [];
      const newCustomers: Record<string, unknown>[] = [];
      const newAddresses: Record<string, unknown>[] = [];
      const updates: { id: string; patch: Record<string, unknown> }[] = [];
      const zipUpdates: { id: string; zip: string }[] = [];

      clean.forEach((r, i) => {
        if (!r.name) {
          results.push({ index: i, action: "skip", reason: "Linha sem nome." });
          return;
        }
        const match = findMatch(r);
        if (match) claimed.add(match.id);
        const isPJ = !!r.cnpj || (!r.cpf && r.type === "PJ");
        const addressRow = (customerId: string, isPrimary: boolean) => ({
          customer_id: customerId,
          street: r.address!.street,
          number: r.address!.number,
          neighborhood: r.address!.neighborhood || "—",
          city: r.address!.city || "Santo André",
          state: r.address!.state || "SP",
          complement: r.address!.complement,
          zip: r.address!.zip,
          reference: r.address!.reference,
          is_primary: isPrimary,
        });

        if (!match) {
          const id = crypto.randomUUID();
          newCustomers.push({
            id,
            name: r.name,
            legal_name: r.legalName,
            notes: r.notes,
            phone: r.phone,
            type: isPJ ? "PJ" : "PF",
            cpf: isPJ ? null : r.cpf,
            cnpj: r.cnpj ? formatCnpj(r.cnpj) : null,
            ie: isPJ ? r.ie : null,
            ie_indicator: isPJ ? r.ieIndicator : null,
            email: r.email,
          });
          if (r.address) newAddresses.push(addressRow(id, true));
          results.push({ index: i, action: "insert", name: r.name, address: r.address ? "nova" : "sem" });
          return;
        }

        // Cliente já existe: completa só o que está vazio.
        const patch: Record<string, unknown> = {};
        if ((!match.name || match.name === "Sem nome") && r.name) patch.name = r.name;
        if (!match.legal_name && r.legalName) patch.legal_name = r.legalName;
        if (!match.notes && r.notes) patch.notes = r.notes;
        if (!match.phone && r.phone) patch.phone = r.phone;
        if (!match.email && r.email) patch.email = r.email;
        if (r.cnpj && !match.cnpj && !match.cpf) {
          patch.cnpj = formatCnpj(r.cnpj);
          patch.type = "PJ";
        }
        if (r.cpf && !match.cpf && !match.cnpj && match.type === "PF") patch.cpf = r.cpf;
        const pj = match.type === "PJ" || patch.type === "PJ";
        if (pj && r.ie && !match.ie) patch.ie = r.ie;
        if (pj && r.ieIndicator && !match.ie_indicator) patch.ie_indicator = r.ieIndicator;
        if (Object.keys(patch).length) updates.push({ id: match.id, patch });

        let address: ImportResult["address"] = "sem";
        if (r.address) {
          const same = match.addresses.find((a) => sameStreet(a.street, r.address!.street) && a.number.trim() === r.address!.number);
          if (same) {
            address = "existente";
            if (!same.zip && r.address.zip) zipUpdates.push({ id: same.id, zip: r.address.zip });
          } else {
            address = match.addresses.length ? "adicional" : "nova";
            newAddresses.push(addressRow(match.id, match.addresses.length === 0));
          }
        }

        const changed = Object.keys(patch).length > 0 || address === "nova" || address === "adicional";
        results.push({
          index: i,
          action: changed ? "update" : "skip",
          name: match.name,
          address,
          reason: changed ? undefined : "Já cadastrado, sem dado novo.",
        });
      });

      if (!dryRun) {
        if (newCustomers.length) {
          const { error } = await adminClient.from("customers").insert(newCustomers);
          if (error) throw error;
        }
        for (const u of updates) {
          const { error } = await adminClient.from("customers").update(u.patch).eq("id", u.id);
          if (error) throw error;
        }
        if (newAddresses.length) {
          const { error } = await adminClient.from("addresses").insert(newAddresses);
          if (error) throw error;
        }
        for (const z of zipUpdates) {
          const { error } = await adminClient.from("addresses").update({ zip: z.zip }).eq("id", z.id);
          if (error) throw error;
        }
      }

      return json({ data: { results } });
    }

    // ---- Nota fiscal ----
    if (action === "invoices.check") {
      const input = await loadNfeInput(String(payload?.orderId || ""));
      return json({ data: { problems: checkNfe(input), environment: NFE_AMBIENTE, fixes: nfeFixes(input) } });
    }

    // "Completar agora": grava só os dados fiscais que faltavam para a nota,
    // sem mexer no resto do cadastro do produto, do cliente ou do endereço.
    if (action === "invoices.fixData") {
      // Preço do item neste pedido. Pedido sem total passa a ter a soma dos itens.
      const prices = (payload?.prices ?? []) as { product_id?: string; unit_price?: unknown }[];
      if (prices.length && payload?.orderId) {
        for (const pr of prices.slice(0, 50)) {
          const value = toUnitPrice(pr.unit_price);
          if (!pr.product_id || value === null || value <= 0) throw new Error("Informe o preço de cada item.");
          const { error } = await adminClient
            .from("order_items")
            .update({ unit_price: value })
            .eq("order_id", payload.orderId)
            .eq("product_id", pr.product_id);
          if (error) throw error;
        }
        const { data: ord, error: ordErr } = await adminClient
          .from("orders")
          .select("total_amount, order_items(qty, unit_price)")
          .eq("id", payload.orderId)
          .single();
        if (ordErr) throw ordErr;
        if (ord.total_amount == null) {
          const items = (ord.order_items ?? []) as { qty: number; unit_price: number | null }[];
          if (items.every((i) => i.unit_price != null)) {
            const sum = Math.round(items.reduce((s, i) => s + i.qty * Number(i.unit_price) * 100, 0)) / 100;
            await adminClient.from("orders").update({ total_amount: sum }).eq("id", payload.orderId);
          }
        }
      }

      const products = (payload?.products ?? []) as Record<string, unknown>[];
      for (const p of products.slice(0, 50)) {
        if (!p?.id) continue;
        const patch: Record<string, unknown> = {};
        for (const key of ["ncm", "cest", "cfop", "cst_csosn", "pis_cofins_cst"]) {
          if (key in p) patch[key] = digitsOrNull(p[key]);
        }
        if ("origem" in p) {
          const origem = Number(p.origem);
          patch.origem = Number.isInteger(origem) && origem >= 0 && origem <= 8 ? origem : 0;
        }
        if (Object.keys(patch).length) {
          const { error } = await adminClient.from("products").update(patch).eq("id", p.id);
          if (error) throw error;
        }
      }

      const cust = payload?.customer as Record<string, unknown> | undefined;
      if (cust?.id) {
        const { data: current, error: curErr } = await adminClient.from("customers").select("type").eq("id", cust.id).single();
        if (curErr) throw curErr;
        const type = current.type as "PF" | "PJ";
        const patch: Record<string, unknown> = customerFiscalFields(cust, type);
        if (type === "PJ" && "cnpj" in cust) {
          const d = digitsOrNull(cust.cnpj);
          if (d && d.length !== 14) throw new Error("CNPJ incompleto.");
          patch.cnpj = d ? formatCnpj(d) : null;
        }
        if (Object.keys(patch).length) {
          const { error } = await adminClient.from("customers").update(patch).eq("id", cust.id);
          if (error) throw error;
        }
      }

      const addr = payload?.address as Record<string, unknown> | undefined;
      if (addr?.id && "zip" in addr) {
        const zip = digitsOrNull(addr.zip);
        if (zip && zip.length !== 8) throw new Error("CEP incompleto.");
        const ibge = zip ? await lookupIbge(zip) : null;
        if (zip && !ibge) throw new Error("CEP não encontrado. Confira o número.");
        const { error } = await adminClient.from("addresses").update({ zip, ibge_code: ibge }).eq("id", addr.id);
        if (error) throw error;
      }

      return json({ ok: true });
    }

    // Testa token, certificado e SEFAZ de uma vez, sem precisar de pedido.
    if (action === "invoices.sefazStatus") {
      const r = await brasilNfe<{
        CodStatusRespostaSefaz?: number; DsStatusRespostaSefaz?: string; DsTipoAmbiente?: string;
        DsEstadoEmitente?: string; erros?: { descricao?: string; correcao?: string }[];
      }>("ConsultarStatusSefaz", { ModeloDocumento: 55 });
      return json({
        data: {
          ok: r.CodStatusRespostaSefaz === 107,
          message: r.DsStatusRespostaSefaz
            ? `${r.CodStatusRespostaSefaz}: ${r.DsStatusRespostaSefaz}`
            : describeNfeError(r as Record<string, never>),
          environment: NFE_AMBIENTE,
          // A consulta de status não recebe ambiente e responde pelo de produção;
          // a emissão continua no ambiente de NFE_AMBIENTE. Mostra só a UF.
          detail: r.DsEstadoEmitente ?? "",
        },
      });
    }

    // Monta o DANFE com a tarja "sem valor fiscal" sem passar pela SEFAZ.
    // Serve para conferir a nota antes de emitir, e funciona sem certificado.
    if (action === "invoices.preview") {
      const input = await loadNfeInput(String(payload?.orderId || ""));
      input.purchaseOrder = payload?.purchaseOrder ? String(payload.purchaseOrder) : null;
      input.notes = payload?.notes ? String(payload.notes) : null;
      const problems = checkNfe(input);
      if (problems.length) return json({ data: { problems } });

      const resp = await brasilNfe<{ Status?: boolean; Base64File?: string; Error?: string; Avisos?: string[] }>(
        "PreVisualizarNotaFiscal",
        {
          notaFiscal: { TipoAmbiente: NFE_AMBIENTE, ModeloDocumento: 55, nFInfos: [buildNfePayload(input, NFE_AMBIENTE)] },
          TipoArquivo: 1,
          TipoEnvio: 1,
          mostrarTarjaPreVisualizacao: true,
        },
      );
      if (!resp.Status || !resp.Base64File) throw new Error(describeNfeError(resp));
      return json({ data: { base64: resp.Base64File, filename: `previa-pedido-${input.orderId.slice(0, 8).toUpperCase()}.pdf` } });
    }

    if (action === "invoices.emit") {
      const orderId = String(payload?.orderId || "");
      const input = await loadNfeInput(orderId);
      input.purchaseOrder = payload?.purchaseOrder ? String(payload.purchaseOrder) : null;
      input.notes = payload?.notes ? String(payload.notes) : null;
      const problems = checkNfe(input);
      if (problems.length) return json({ data: { problems } });

      const { data: created, error: insErr } = await adminClient
        .from("invoices")
        .insert({
          order_id: orderId,
          environment: NFE_AMBIENTE,
          status: "processando",
          total: input.totalAmount,
          created_by: admin.username,
        })
        .select("id")
        .single();
      if (insErr) {
        if ((insErr as { code?: string }).code === "23505") throw new Error("Este pedido já tem uma nota emitida ou em emissão.");
        throw insErr;
      }

      let resp: NfeResponse;
      try {
        resp = await brasilNfe<NfeResponse>("EnviarNotaFiscal", buildNfePayload(input, NFE_AMBIENTE));
      } catch (err) {
        if (err instanceof BrasilNfeOffline) {
          const invoice = await updateInvoice(created.id, {
            message: "A Brasil NFe não respondeu a tempo. Toque em Atualizar status em alguns minutos.",
          });
          return json({ data: { invoice } });
        }
        await updateInvoice(created.id, { status: "erro", message: err instanceof Error ? err.message : "Erro ao emitir." });
        throw err;
      }

      const r = resp.ReturnNF;
      let patch: Record<string, unknown>;
      if (r?.Ok) {
        patch = {
          status: "autorizada",
          numero: r.Numero ?? null,
          serie: r.Serie ?? null,
          chave: r.ChaveNF ?? null,
          protocolo: r.NumeroProtocolo ?? null,
          sefaz_code: r.CodStatusRespostaSefaz ?? null,
          message: resp.Avisos?.length ? resp.Avisos.join(" · ") : null,
          xml: resp.Base64Xml ? decodeBase64Utf8(resp.Base64Xml) : null,
          authorized_at: new Date().toISOString(),
        };
      } else if (isStillProcessing(r?.CodStatusRespostaSefaz)) {
        patch = {
          sefaz_code: r?.CodStatusRespostaSefaz ?? null,
          chave: r?.ChaveNF ?? null,
          message: "A SEFAZ ainda está processando. Toque em Atualizar status em alguns minutos.",
        };
      } else {
        patch = { status: "erro", sefaz_code: r?.CodStatusRespostaSefaz ?? null, message: describeNfeError(resp) };
      }
      const invoice = await updateInvoice(created.id, patch);
      return json({ data: { invoice } });
    }

    if (action === "invoices.refresh") {
      const inv = await getInvoice(String(payload?.invoiceId || ""));
      if (inv.status !== "processando") {
        const { xml: _xml, ...rest } = inv;
        return json({ data: { invoice: rest } });
      }

      const day = 24 * 60 * 60 * 1000;
      const created = new Date(inv.created_at).getTime();
      const found = await brasilNfe<{ Notas?: { Chave?: string; Numero?: number; Serie?: string; NumeroProtocolo?: string; Status?: number }[]; Error?: string }>(
        "ObterNotasFiscais",
        {
          TipoAmbiente: inv.environment,
          TipoDocumentoFiscal: 1,
          IdentificadorInterno: inv.order_id,
          DtInicio: new Date(created - day).toISOString().slice(0, 19),
          DtFim: new Date(Date.now() + day).toISOString().slice(0, 19),
        },
      );
      const nota = (found.Notas ?? []).find((n) => n.Chave) ?? null;

      let patch: Record<string, unknown>;
      if (nota?.Status === 1) {
        const b64 = await brasilNfe<string>("ObterArquivoNotaFiscal", { ChaveNF: nota.Chave, FileType: 1, TipoDocumentoFiscal: 1 });
        patch = {
          status: "autorizada",
          chave: nota.Chave,
          numero: nota.Numero ?? null,
          serie: nota.Serie ? Number(nota.Serie) : null,
          protocolo: nota.NumeroProtocolo ?? null,
          message: null,
          xml: typeof b64 === "string" && b64 ? decodeBase64Utf8(b64) : null,
          authorized_at: new Date().toISOString(),
        };
      } else if (nota?.Status === 2) {
        patch = { status: "cancelada", chave: nota.Chave, cancelled_at: new Date().toISOString() };
      } else if (nota?.Status === 3) {
        patch = { status: "erro", chave: nota.Chave, message: "Uso denegado pela SEFAZ. Fale com o contador." };
      } else if (Date.now() - created > 10 * 60 * 1000) {
        patch = { status: "erro", message: "A nota não chegou a ser registrada. Confira os dados e emita de novo." };
      } else {
        patch = { message: "A SEFAZ ainda está processando. Tente de novo em alguns minutos." };
      }
      const invoice = await updateInvoice(inv.id, patch);
      return json({ data: { invoice } });
    }

    if (action === "invoices.cancel") {
      const inv = await getInvoice(String(payload?.invoiceId || ""));
      const reason = String(payload?.reason || "").trim();
      if (inv.status !== "autorizada" || !inv.chave) throw new Error("Só é possível cancelar nota autorizada.");
      if (reason.length < 15) throw new Error("Descreva o motivo do cancelamento com pelo menos 15 caracteres.");

      const resp = await brasilNfe<NfeEvent>("CancelarNotaFiscal", {
        ChaveNF: inv.chave,
        Justificativa: reason.slice(0, 255),
        TipoAmbiente: inv.environment,
        TipoDocumento: 0,
      });
      if (resp.Status === 1) {
        const invoice = await updateInvoice(inv.id, { status: "cancelada", cancelled_at: new Date().toISOString(), message: `Cancelada: ${reason}` });
        return json({ data: { invoice } });
      }
      if (resp.Status === 2) {
        const invoice = await updateInvoice(inv.id, { message: "Cancelamento enviado e ainda em processamento na SEFAZ." });
        return json({ data: { invoice } });
      }
      throw new Error(resp.DsMotivo || resp.Error || "A SEFAZ recusou o cancelamento.");
    }

    if (action === "invoices.correct") {
      const inv = await getInvoice(String(payload?.invoiceId || ""));
      const text = String(payload?.text || "").trim();
      if (inv.status !== "autorizada" || !inv.chave) throw new Error("Só é possível corrigir nota autorizada.");
      if (text.length < 15) throw new Error("Descreva a correção com pelo menos 15 caracteres.");

      const seq = (inv.correction_seq ?? 0) + 1;
      const resp = await brasilNfe<NfeEvent>("EnviarCartaCorrecao", {
        TipoAmbiente: inv.environment,
        ChaveNF: inv.chave,
        Correcao: text.slice(0, 1000),
        NumeroSequencial: seq,
      });
      if (resp.Status !== 1) throw new Error(resp.DsMotivo || resp.Error || "A SEFAZ recusou a carta de correção.");
      const invoice = await updateInvoice(inv.id, { correction_seq: seq, message: `Carta de correção ${seq}: ${text}` });
      return json({ data: { invoice } });
    }

    if (action === "invoices.file") {
      const inv = await getInvoice(String(payload?.invoiceId || ""));
      if (!inv.chave) throw new Error("Esta nota ainda não tem chave de acesso.");
      if (payload?.type === "xml") {
        if (!inv.xml) throw new Error("O XML desta nota não está salvo.");
        return json({ data: { content: inv.xml, filename: `NFe${inv.chave}.xml` } });
      }
      const b64 = await brasilNfe<string>("ObterArquivoNotaFiscal", { ChaveNF: inv.chave, FileType: 2, TipoDocumentoFiscal: 1 });
      if (typeof b64 !== "string" || !b64) throw new Error("A Brasil NFe não devolveu o DANFE.");
      return json({ data: { base64: b64, filename: `DANFE-${inv.numero ?? inv.chave}.pdf` } });
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

    // Troca só o bloco de pagamento, sem mexer em itens, endereço ou status.
    // Vale para pedido já entregue: é o caminho de correção quando o
    // combinado mudou na porta do cliente.
    if (action === "orders.updatePayment") {
      const orderId = payload?.orderId as string;
      if (!orderId) throw new Error("Pedido inválido.");

      const { data: order, error: fetchError } = await adminClient
        .from("orders")
        .select("id, status")
        .eq("id", orderId)
        .maybeSingle();
      if (fetchError) throw fetchError;
      if (!order) throw new Error("Pedido não encontrado.");

      const payment = normalizePaymentUpdate((payload?.payment ?? {}) as Record<string, unknown>);

      const { error } = await adminClient
        .from("orders")
        .update({
          ...payment,
          ...pixResetFields(payment),
          updated_at: new Date().toISOString(),
          updated_by: admin.username,
        })
        .eq("id", orderId);
      if (error) throw error;

      return json({ data: { ok: true, ...payment } });
    }

    if (action === "orders.bulkUpdate") {
      const orderIds = (payload?.orderIds || []) as string[];
      const updates = (payload?.updates || {}) as Record<string, unknown>;
      if (!Array.isArray(orderIds) || orderIds.length === 0) throw new Error("Nenhum pedido selecionado");
      if (orderIds.length > 500) throw new Error("Máximo de 500 pedidos por operação");

      const allowed: Record<string, unknown> = {};
      if (typeof updates.status === "string") allowed.status = updates.status;
      if (updates.rider_id === null || typeof updates.rider_id === "string") allowed.rider_id = updates.rider_id;
      if (updates.payment_method === null || typeof updates.payment_method === "string") {
        const method = updates.payment_method as string | null;
        if (method && !PAYMENT_METHODS.includes(method)) throw new Error("Forma de pagamento inválida.");
        // Trocar a forma em lote desfaz o pagamento dividido: uma forma só
        // não pode conviver com as parcelas antigas no relatório de caixa.
        Object.assign(allowed, {
          payment_method: method,
          payment_method_2: null,
          payment_amount_1: null,
          payment_amount_2: null,
          change_for_2: null,
          is_split_payment: false,
        });
        if (method !== "pix") {
          allowed.pix_paid = false;
          allowed.pix_paid_at = null;
        }
      }

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

      const { data: rows, error: rowsErr } = await adminClient
        .from("orders")
        .select("id,status")
        .in("id", orderIds);
      if (rowsErr) throw rowsErr;
      const candidates = (rows ?? []).filter((r) => r.status !== "entregue").map((r) => r.id);
      const skipped = orderIds.length - candidates.length;

      // Nota de produção autorizada ou cancelada é documento fiscal com guarda
      // de 5 anos: o pedido dela não é excluído. Nota de teste (homologação) e
      // tentativa recusada saem junto com o pedido.
      let skippedFiscal = 0;
      let deletable = candidates;
      if (candidates.length > 0) {
        const { data: inv, error: invErr } = await adminClient
          .from("invoices")
          .select("order_id, environment, status")
          .in("order_id", candidates);
        if (invErr) throw invErr;
        const fiscal = new Set(
          (inv ?? []).filter((i) => i.environment === 1 && i.status !== "erro").map((i) => i.order_id),
        );
        skippedFiscal = fiscal.size;
        deletable = candidates.filter((id) => !fiscal.has(id));
      }

      // Ordem importa: o pedido só some depois de tudo que aponta para ele, e
      // nada é apagado se a consulta acima falhar.
      if (deletable.length > 0) {
        const { error: invDelErr } = await adminClient.from("invoices").delete().in("order_id", deletable);
        if (invDelErr) throw invDelErr;
        const { error: itemsErr } = await adminClient.from("order_items").delete().in("order_id", deletable);
        if (itemsErr) throw itemsErr;
        const { error } = await adminClient.from("orders").delete().in("id", deletable);
        if (error) throw error;
      }
      return json({ data: { ok: true, deleted: deletable.length, deletedIds: deletable, skipped, skippedFiscal } });
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
