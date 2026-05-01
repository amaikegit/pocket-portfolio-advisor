import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

async function sendTelegramMessage(chatId: number, text: string, parseMode = "HTML") {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  if (!TELEGRAM_API_KEY) throw new Error("TELEGRAM_API_KEY is not configured");

  const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(`Telegram sendMessage failed [${res.status}]: ${JSON.stringify(data)}`);
  }
  return data.result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Optional body: { chat_id, text } for direct send (used by other functions internally)
    let direct: { chat_id?: number; text?: string; parse_mode?: string } = {};
    try { direct = await req.json(); } catch {}

    if (direct.chat_id && direct.text) {
      const result = await sendTelegramMessage(direct.chat_id, direct.text, direct.parse_mode);
      return new Response(JSON.stringify({ ok: true, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Otherwise: drain the outbox
    const { data: pending, error } = await admin
      .from("telegram_outbox")
      .select("id, chat_id, text, parse_mode, attempts")
      .eq("status", "pending")
      .lt("attempts", 5)
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) throw error;

    let sent = 0;
    let failed = 0;
    for (const msg of pending ?? []) {
      try {
        await sendTelegramMessage(Number(msg.chat_id), msg.text, msg.parse_mode || "HTML");
        await admin.from("telegram_outbox").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          attempts: (msg.attempts ?? 0) + 1,
        }).eq("id", msg.id);
        sent++;
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        const newAttempts = (msg.attempts ?? 0) + 1;
        await admin.from("telegram_outbox").update({
          status: newAttempts >= 5 ? "failed" : "pending",
          attempts: newAttempts,
          last_error: errMsg.slice(0, 500),
        }).eq("id", msg.id);
        failed++;
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, failed, processed: (pending ?? []).length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("telegram-send error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});