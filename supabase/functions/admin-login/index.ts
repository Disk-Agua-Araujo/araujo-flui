import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// In-memory rate limiting (per-isolate; resets on cold start but still effective)
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(key: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record) return { allowed: true };
  if (record.lockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((record.lockedUntil - now) / 1000) };
  }
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
    return { allowed: false, retryAfter: Math.ceil(LOCKOUT_MS / 1000) };
  }
  return { allowed: true };
}

function recordFailure(key: string) {
  const now = Date.now();
  const record = loginAttempts.get(key) || { count: 0, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
  }
  loginAttempts.set(key, record);
}

function clearFailures(key: string) {
  loginAttempts.delete(key);
}

/** Timing-safe string comparison */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode("comparison-key");
  const key = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sigA = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(a)));
  const sigB = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(b)));
  if (sigA.length !== sigB.length) return false;
  let result = 0;
  for (let i = 0; i < sigA.length; i++) {
    result |= sigA[i] ^ sigB[i];
  }
  return result === 0;
}

interface AdminUser {
  username: string;
  password: string;
  role: string;
}

function getAdminUsers(): AdminUser[] {
  const raw = Deno.env.get("ADMIN_CREDENTIALS");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

async function signJWT(
  payload: Record<string, unknown>,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${header}.${body}`)
  );
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${header}.${body}.${signature}`;
}

async function verifyJWT(
  token: string,
  secret: string
): Promise<Record<string, unknown> | null> {
  try {
    const [header, body, signature] = token.split(".");
    if (!header || !body || !signature) return null;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const sigStr = signature.replace(/-/g, "+").replace(/_/g, "/");
    const sigBytes = Uint8Array.from(atob(sigStr), (c) => c.charCodeAt(0));

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      encoder.encode(`${header}.${body}`)
    );
    if (!valid) return null;

    const payload = JSON.parse(atob(body));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "login";

  const jwtSecret = Deno.env.get("ADMIN_JWT_SECRET");
  if (!jwtSecret) {
    return new Response(
      JSON.stringify({ error: "Configuração do servidor ausente. Contate o administrador." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── VERIFY ─────────────────────────────────────────────
  if (action === "verify") {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const payload = await verifyJWT(token, jwtSecret);
    if (!payload) {
      return new Response(JSON.stringify({ valid: false }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ valid: true, ...payload }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── LOGIN ──────────────────────────────────────────────
  if (req.method !== "POST") {
    return new Response("Método não permitido", { status: 405, headers: corsHeaders });
  }

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Requisição inválida." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { username, password } = body;
  if (!username || !password || username.length > 100 || password.length > 200) {
    return new Response(
      JSON.stringify({ error: "Usuário e senha são obrigatórios." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Rate limit check
  const rateLimitKey = username.toLowerCase();
  const rateCheck = checkRateLimit(rateLimitKey);
  if (!rateCheck.allowed) {
    const headers: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": "application/json",
    };
    if (rateCheck.retryAfter) {
      headers["Retry-After"] = String(rateCheck.retryAfter);
    }
    return new Response(
      JSON.stringify({ error: "Muitas tentativas. Tente novamente mais tarde." }),
      { status: 429, headers }
    );
  }

  const adminUsers = getAdminUsers();
  if (adminUsers.length === 0) {
    console.error("ADMIN_CREDENTIALS secret is missing or invalid");
    return new Response(
      JSON.stringify({ error: "Configuração do servidor ausente. Contate o administrador." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Find matching user with timing-safe comparison
  let match: AdminUser | null = null;
  for (const user of adminUsers) {
    const usernameMatch = await timingSafeEqual(user.username, username);
    const passwordMatch = await timingSafeEqual(user.password, password);
    if (usernameMatch && passwordMatch) {
      match = user;
      break;
    }
  }

  if (!match) {
    recordFailure(rateLimitKey);
    return new Response(
      JSON.stringify({ error: "Usuário ou senha inválidos." }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  clearFailures(rateLimitKey);

  const token = await signJWT(
    {
      sub: match.username,
      role: match.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
    },
    jwtSecret
  );

  return new Response(
    JSON.stringify({ token, role: match.role, username: match.username }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
