import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_REQUESTS = 10;
const WINDOW_SECONDS = 60;

// Allowed origins for referer/origin validation
const ALLOWED_ORIGINS = [
  "https://araujo-flui.lovable.app",
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
  const sb = getServiceClient();
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_SECONDS * 1000);

  // Try to get existing record
  const { data: existing } = await sb
    .from("geocode_rate_limits")
    .select("id, request_count, window_start")
    .eq("client_ip", clientIp)
    .single();

  if (!existing) {
    // First request from this IP
    await sb.from("geocode_rate_limits").insert({ client_ip: clientIp, request_count: 1, window_start: now.toISOString() });
    return false;
  }

  const recordWindow = new Date(existing.window_start);
  if (recordWindow < windowStart) {
    // Window expired, reset
    await sb.from("geocode_rate_limits").update({ request_count: 1, window_start: now.toISOString() }).eq("id", existing.id);
    return false;
  }

  if (existing.request_count >= MAX_REQUESTS) {
    return true;
  }

  // Increment
  await sb.from("geocode_rate_limits").update({ request_count: existing.request_count + 1 }).eq("id", existing.id);
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

  // DB-backed rate limiting
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (await isRateLimited(clientIp)) {
    return new Response(JSON.stringify({ error: "rate_limited", message: "Muitas requisições. Tente novamente em breve." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { address } = await req.json();
    if (!address || typeof address !== "string" || address.length > 500) {
      return new Response(JSON.stringify({ error: "address is required (max 500 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "no_api_key", message: "Serviço de geocodificação indisponível." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}&region=br&language=pt-BR`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK" || !data.results?.length) {
      return new Response(
        JSON.stringify({ error: "geocode_failed", message: "Não foi possível localizar o endereço." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const location = data.results[0].geometry.location;
    return new Response(
      JSON.stringify({ lat: location.lat, lng: location.lng }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("geocode error:", err);
    return new Response(
      JSON.stringify({ error: "server_error", message: "Erro interno do servidor." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
