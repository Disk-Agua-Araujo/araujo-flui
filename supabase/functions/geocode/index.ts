import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiting per IP
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS = 10; // reduced from 20
const WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(ip);
  if (!record || record.resetAt < now) {
    requestCounts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  record.count++;
  return record.count > MAX_REQUESTS;
}

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate origin/referer to prevent external abuse
  if (!isAllowedOrigin(req)) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate anon key as additional layer
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

  // Rate limit by forwarded IP
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(clientIp)) {
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
