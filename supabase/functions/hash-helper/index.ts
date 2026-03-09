import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const { passwords } = await req.json();
  const results: Record<string, string> = {};
  for (const [key, pwd] of Object.entries(passwords as Record<string, string>)) {
    results[key] = await bcrypt.hash(pwd);
  }
  return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
