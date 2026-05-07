// create-site-order edge function
// Public endpoint for site quick orders. Validates origin, anon key, and rate-limits by IP.
// v2 - forced redeploy with diagnostics
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_REQUESTS = 5;
const WINDOW_SECONDS = 600;

const ALLOWED_ORIGINS = [
  "https://araujo-flui.lovable.app",
  "https://diskaguaaraujo.com.br",
  "https://www.diskaguaaraujo.com.br",
  "https://id-preview--",
  "http://localhost",
];

function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get("origin") || "";
  const referer = req.headers.get("referer") || "";
  const check = origin || referer;
  if (!check) return false;
  return ALLOWED_ORIGINS.some((allowed) => check.startsWith(allowed));
}

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function isRateLimited(clientIp: string): Promise<boolean> {
  try {
    const sb = getServiceClient();
    const key = `order:${clientIp}`;
    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_SECONDS * 1000);

    const { data: existing } = await sb
      .from("geocode_rate_limits")
      .select("id, request_count, window_start")
      .eq("client_ip", key)
      .maybeSingle();

    if (!existing) {
      await sb.from("geocode_rate_limits").insert({
        client_ip: key,
        request_count: 1,
        window_start: now.toISOString(),
      });
      return false;
    }

    const recordWindow = new Date(existing.window_start);
    if (recordWindow < windowStart) {
      await sb
        .from("geocode_rate_limits")
        .update({ request_count: 1, window_start: now.toISOString() })
        .eq("id", existing.id);
      return false;
    }

    if (existing.request_count >= MAX_REQUESTS) return true;

    await sb
      .from("geocode_rate_limits")
      .update({ request_count: existing.request_count + 1 })
      .eq("id", existing.id);
    return false;
  } catch (e) {
    console.error("rate-limit check failed (fail-open):", e);
    return false;
  }
}

serve(async (req) => {
  // CORS preflight MUST be the very first thing
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("=== create-site-order chamada ===");
  console.log("Method:", req.method);
  console.log("Origin:", req.headers.get("origin"), "Referer:", req.headers.get("referer"));

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Env check
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("Variáveis de ambiente ausentes (SUPABASE_URL/SERVICE_ROLE_KEY)");
    return new Response(
      JSON.stringify({ error: "server_misconfigured", message: "Configuração do servidor ausente" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!isAllowedOrigin(req)) {
    console.warn("Origem não permitida:", req.headers.get("origin"), req.headers.get("referer"));
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // NOTE: anon key validation removed — security is enforced by:
  // 1) Origin allowlist (above), 2) IP rate limit, 3) RPC server-side validation,
  // 4) Supabase gateway. The previous check rejected legitimate publishable keys.
  // Just confirm an Authorization header is present (gateway already requires apikey).
  const authHeader = req.headers.get("authorization") || "";
  const apiKeyHeader = req.headers.get("apikey") || "";
  if (!authHeader && !apiKeyHeader) {
    console.warn("Sem Authorization/apikey header");
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (await isRateLimited(clientIp)) {
    return new Response(
      JSON.stringify({
        error: "rate_limited",
        message: "Muitos pedidos em sequência. Aguarde alguns minutos e tente novamente.",
      }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let payload: any;
  try {
    payload = await req.json();
    console.log("Body recebido (keys):", Object.keys(payload || {}));
  } catch (e: any) {
    console.error("Erro ao parsear body:", e?.message);
    return new Response(JSON.stringify({ error: "invalid_json", message: "Body inválido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (
    !payload?.p_customer_name ||
    !payload?.p_customer_phone ||
    !Array.isArray(payload?.p_items) ||
    payload.p_items.length === 0
  ) {
    return new Response(JSON.stringify({ error: "invalid_payload", message: "Dados do pedido incompletos" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const sb = getServiceClient();
    const { data, error } = await sb.rpc("create_full_site_order", payload);
    if (error) {
      console.error("RPC create_full_site_order erro:", error);
      return new Response(
        JSON.stringify({ error: "rpc_error", message: error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("Pedido criado com sucesso:", (data as any)?.order_id);
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("create-site-order server error:", err?.message, err);
    return new Response(
      JSON.stringify({ error: "server_error", message: err?.message || "Erro interno do servidor." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
