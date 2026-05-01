import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Invalidate previous unused codes for this user
    await admin.from("telegram_link_codes")
      .delete()
      .is("used_at", null)
      .eq("user_id", u.user.id);

    // Generate unique 6-digit code
    let code = "";
    for (let i = 0; i < 5; i++) {
      const candidate = String(Math.floor(100000 + Math.random() * 900000));
      const { data: exists } = await admin
        .from("telegram_link_codes")
        .select("id")
        .eq("code", candidate)
        .is("used_at", null)
        .maybeSingle();
      if (!exists) { code = candidate; break; }
    }
    if (!code) throw new Error("Could not generate unique code");

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error: insErr } = await admin.from("telegram_link_codes").insert({
      user_id: u.user.id,
      code,
      expires_at: expiresAt,
    });
    if (insErr) throw insErr;

    // Try to learn bot username for nicer instructions
    let botUsername: string | null = null;
    try {
      const me = await fetch("https://connector-gateway.lovable.dev/telegram/getMe", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
          "X-Connection-Api-Key": Deno.env.get("TELEGRAM_API_KEY")!,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      const meData = await me.json();
      if (me.ok && meData.ok) botUsername = meData.result?.username ?? null;
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({ code, expires_at: expiresAt, bot_username: botUsername }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("telegram-link-code error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});