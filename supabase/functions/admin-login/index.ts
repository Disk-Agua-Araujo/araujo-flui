import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Credentials stored as secret ADMIN_CREDENTIALS:
// [{"username":"MLucindodisk","password":"MDisk2025/01/06","role":"admin_owner"},
//  {"username":"ISALucindodisk","password":"ISADisk2025/01/06","role":"admin_manager"}]

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Admin credentials stored as env – set via secrets tool
// ADMIN_CREDENTIALS = JSON array: [{"username":"...","password":"...","role":"admin_owner"}, ...]
// ADMIN_JWT_SECRET  = string used to sign tokens

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

    // Restore base64
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
  const credsRawEarly = Deno.env.get("ADMIN_CREDENTIALS");
  console.log("ENV check — ADMIN_JWT_SECRET set:", !!jwtSecret, "ADMIN_CREDENTIALS set:", !!credsRawEarly);
  if (!jwtSecret) {
    return new Response(
      JSON.stringify({ error: "Configuração do servidor ausente (JWT). Contate o administrador." }),
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
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const { username, password } = await req.json();
  if (!username || !password) {
    return new Response(
      JSON.stringify({ error: "Usuário e senha são obrigatórios" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const credsRaw = Deno.env.get("ADMIN_CREDENTIALS");
  if (!credsRaw) {
    return new Response(
      JSON.stringify({ error: "Configuração do servidor ausente (credenciais). Contate o administrador." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let creds: { username: string; password: string; role: string }[];
  try {
    creds = JSON.parse(credsRaw);
  } catch (e) {
    console.error("Failed to parse ADMIN_CREDENTIALS:", e, "raw value length:", credsRaw.length, "first 20 chars:", credsRaw.substring(0, 20));
    return new Response(
      JSON.stringify({ error: "Configuração do servidor inválida (credenciais). Contate o administrador." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const match = creds.find(
    (c) => c.username === username && c.password === password
  );

  if (!match) {
    return new Response(
      JSON.stringify({ error: "Usuário ou senha inválidos" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const token = await signJWT(
    {
      sub: match.username,
      role: match.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12, // 12h
    },
    jwtSecret
  );

  return new Response(
    JSON.stringify({ token, role: match.role, username: match.username }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
