import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { compareSync } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 15 * 60; // 15 minutes

function getDbClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function checkRateLimit(db: ReturnType<typeof getDbClient>, key: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const { data } = await db
    .from("login_attempts")
    .select("failed_count, locked_until")
    .eq("attempt_key", key)
    .maybeSingle();

  if (!data) return { allowed: true };

  if (data.locked_until) {
    const lockedUntil = new Date(data.locked_until).getTime();
    const now = Date.now();
    if (lockedUntil > now) {
      return { allowed: false, retryAfter: Math.ceil((lockedUntil - now) / 1000) };
    }
    // Lock expired, reset
    await db.from("login_attempts").delete().eq("attempt_key", key);
    return { allowed: true };
  }

  if (data.failed_count >= MAX_ATTEMPTS) {
    // Should have been locked, lock now
    const lockUntil = new Date(Date.now() + LOCKOUT_SECONDS * 1000).toISOString();
    await db.from("login_attempts").update({ locked_until: lockUntil }).eq("attempt_key", key);
    return { allowed: false, retryAfter: LOCKOUT_SECONDS };
  }

  return { allowed: true };
}

async function recordFailure(db: ReturnType<typeof getDbClient>, key: string) {
  const { data } = await db
    .from("login_attempts")
    .select("failed_count")
    .eq("attempt_key", key)
    .maybeSingle();

  const newCount = (data?.failed_count || 0) + 1;
  const lockUntil = newCount >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_SECONDS * 1000).toISOString() : null;

  if (data) {
    await db.from("login_attempts").update({
      failed_count: newCount,
      locked_until: lockUntil,
      last_attempt_at: new Date().toISOString(),
    }).eq("attempt_key", key);
  } else {
    await db.from("login_attempts").insert({
      attempt_key: key,
      failed_count: newCount,
      locked_until: lockUntil,
      last_attempt_at: new Date().toISOString(),
    });
  }
}

async function clearFailures(db: ReturnType<typeof getDbClient>, key: string) {
  await db.from("login_attempts").delete().eq("attempt_key", key);
}

interface AdminUser {
  username: string;
  password_hash: string;
  role: string;
}

function getAdminUsers(): { users: AdminUser[]; error: string | null } {
  const raw = Deno.env.get("ADMIN_CREDENTIALS");
  if (!raw || raw.trim() === "") {
    console.error("[admin-login] ADMIN_CREDENTIALS secret is missing or empty");
    return { users: [], error: "missing" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error("[admin-login] ADMIN_CREDENTIALS is not valid JSON:", e);
    return { users: [], error: "invalid_json" };
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    console.error("[admin-login] ADMIN_CREDENTIALS must be a non-empty JSON array");
    return { users: [], error: "empty_array" };
  }

  for (let i = 0; i < parsed.length; i++) {
    const u = parsed[i];
    if (
      !u || typeof u !== "object" ||
      typeof u.username !== "string" || !u.username.trim() ||
      typeof u.password_hash !== "string" || !u.password_hash.trim() ||
      typeof u.role !== "string" || !["admin_owner", "admin_manager"].includes(u.role)
    ) {
      console.error(`[admin-login] ADMIN_CREDENTIALS[${i}] has invalid schema.`);
      return { users: [], error: "invalid_schema" };
    }
  }

  return { users: parsed as AdminUser[], error: null };
}

async function signJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`${header}.${body}`));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${header}.${body}.${signature}`;
}

async function verifyJWT(token: string, secret: string): Promise<Record<string, unknown> | null> {
  try {
    const [header, body, signature] = token.split(".");
    if (!header || !body || !signature) return null;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
    );
    const sigStr = signature.replace(/-/g, "+").replace(/_/g, "/");
    const sigBytes = Uint8Array.from(atob(sigStr), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(`${header}.${body}`));
    if (!valid) return null;
    const payload = JSON.parse(atob(body));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const CONFIG_ERROR_MSG = "Configuração do Admin ausente. Verifique os secrets no painel.";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "login";

  const jwtSecret = Deno.env.get("ADMIN_JWT_SECRET");
  if (!jwtSecret || jwtSecret.length < 32) {
    console.error("[admin-login] ADMIN_JWT_SECRET is missing or too short (min 32 chars)");
    return jsonResponse({ error: CONFIG_ERROR_MSG }, 500);
  }

  // ── VERIFY ─────────────────────────────────────────────
  if (action === "verify") {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return jsonResponse({ valid: false }, 401);
    const payload = await verifyJWT(token, jwtSecret);
    if (!payload) return jsonResponse({ valid: false }, 401);
    return jsonResponse({ valid: true, sub: payload.sub, role: payload.role });
  }

  // ── LOGIN ──────────────────────────────────────────────
  if (req.method !== "POST") {
    return new Response("Método não permitido", { status: 405, headers: corsHeaders });
  }

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Requisição inválida." }, 400);
  }

  const { username, password } = body;
  if (!username || !password || username.length > 100 || password.length > 200) {
    return jsonResponse({ error: "Usuário e senha são obrigatórios." }, 400);
  }

  // Persistent rate limiting via database
  const db = getDbClient();
  const rateLimitKey = username.toLowerCase();
  const rateCheck = await checkRateLimit(db, rateLimitKey);
  if (!rateCheck.allowed) {
    return new Response(
      JSON.stringify({ error: "Muitas tentativas. Tente novamente mais tarde." }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          ...(rateCheck.retryAfter ? { "Retry-After": String(rateCheck.retryAfter) } : {}),
        },
      }
    );
  }

  const { users: adminUsers, error: credError } = getAdminUsers();
  if (credError) {
    return jsonResponse({ error: CONFIG_ERROR_MSG }, 500);
  }

  // Find matching user using bcrypt hash comparison
  let match: AdminUser | null = null;
  for (const user of adminUsers) {
    if (user.username === username) {
      try {
        const passwordValid = compareSync(password, user.password_hash);
        if (passwordValid) {
          match = user;
        }
      } catch (e) {
        console.error("[admin-login] bcrypt compare error:", e);
      }
      break;
    }
  }

  if (!match) {
    await recordFailure(db, rateLimitKey);
    return jsonResponse({ error: "Usuário ou senha inválidos." }, 401);
  }

  await clearFailures(db, rateLimitKey);

  // JWT with 10-year expiry — logout is explicit only
  const token = await signJWT(
    {
      sub: match.username,
      role: match.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 60 * 60,
    },
    jwtSecret
  );

  return jsonResponse({ token, role: match.role, username: match.username });
});
