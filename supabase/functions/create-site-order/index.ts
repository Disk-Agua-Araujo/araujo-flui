import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_REQUESTS = 5;          // max orders per IP per window
const WINDOW_SECONDS = 600;      // 10 minutes

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

// Reuses the geocode_rate_limits table, namespacing by prefix
async function isRateLimited(clientIp: string): Promise<boolean> {
  const sb = getServiceClient();
  const key = `order:${clientIp}`;
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_SECONDS * 1000);

  const { data: existing } = await sb
    .from("geocode_rate_limits")
    .select("id, request_count, window_start")
    .eq("client_ip", key)
    .single();

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

  if (existing.request_count >= MAX_REQUESTS) {
    return true;
  }

  await sb
    .from("geocode_rate_limits")
    .update({ request_count: existing.request_count + 1 })
    .eq("id", existing.id);
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!isAllowedOrigin(req)) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate anon key
  const authHeader = req.headers.get("authorization") || "";
  const apiKeyHeader = req.headers.get("apikey") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (anonKey) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token !== anonKey && apiKeyHeader !== anonKey) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // IP-based rate limit
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
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Light client-side shape validation; the RPC enforces deep validation.
  if (
    !payload?.p_customer_name ||
    !payload?.p_customer_phone ||
    !Array.isArray(payload?.p_items) ||
    payload.p_items.length === 0
  ) {
    return new Response(JSON.stringify({ error: "invalid_payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const sb = getServiceClient();
    const { data, error } = await sb.rpc("create_full_site_order", payload);
    if (error) {
      return new Response(
        JSON.stringify({ error: "rpc_error", message: error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-site-order error:", err);
    return new Response(
      JSON.stringify({ error: "server_error", message: "Erro interno do servidor." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
