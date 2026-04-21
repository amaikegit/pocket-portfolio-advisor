import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Optional: { user_id, report_type } body for manual single-user run
    let body: { user_id?: string; report_type?: string } = {};
    try { body = await req.json(); } catch {}
    const reportType = body.report_type || "weekly";

    let users: { id: string }[] = [];
    if (body.user_id) {
      users = [{ id: body.user_id }];
    } else {
      const { data: assetsRows } = await admin.from("assets").select("user_id");
      const ids = Array.from(new Set((assetsRows ?? []).map((r: any) => r.user_id)));
      users = ids.map((id) => ({ id }));
    }

    let processed = 0;
    const errors: string[] = [];

    for (const u of users) {
      try {
        const { data: assets } = await admin.from("assets").select("*").eq("user_id", u.id);
        if (!assets || assets.length === 0) continue;

        // Last week dividends
        const since = new Date();
        since.setDate(since.getDate() - 7);
        const { data: divs } = await admin
          .from("dividends")
          .select("ticker, amount, payment_date")
          .eq("user_id", u.id)
          .gte("payment_date", since.toISOString().slice(0, 10));

        // Snapshots last 30d for trend
        const since30 = new Date();
        since30.setDate(since30.getDate() - 30);
        const { data: snaps } = await admin
          .from("portfolio_snapshots")
          .select("snapshot_date, total_current, total_invested, total_difference")
          .eq("user_id", u.id)
          .gte("snapshot_date", since30.toISOString().slice(0, 10))
          .order("snapshot_date", { ascending: true });

        const totalInvested = assets.reduce((s: number, a: any) => s + Number(a.total_invested || 0), 0);
        const totalCurrent = assets.reduce((s: number, a: any) => s + Number(a.quantity || 0) * Number(a.current_price || 0), 0);
        const dividendsWeek = (divs ?? []).reduce((s: number, d: any) => s + Number(d.amount || 0), 0);

        const portfolioSummary = {
          totalInvested,
          totalCurrent,
          difference: totalCurrent - totalInvested,
          rentabilidadePct: totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0,
          ativos: assets.map((a: any) => ({
            ticker: a.ticker,
            cotas: Number(a.quantity),
            precoMedio: Number(a.average_price),
            precoAtual: Number(a.current_price),
            dy: Number(a.dividend_yield),
            pvp: Number(a.pvp),
          })),
          dividendosUltimaSemana: {
            total: dividendsWeek,
            quantidade: divs?.length ?? 0,
            detalhes: divs ?? [],
          },
          tendencia30d: snaps ?? [],
        };

        const systemPrompt = `Você é um analista financeiro especialista em FIIs e ações brasileiras.
Gere um RELATÓRIO SEMANAL conciso (máximo 600 palavras) em português brasileiro com:

1. **Resumo Executivo** (2-3 linhas sobre o estado da carteira)
2. **Performance da Semana** (variação patrimonial e dividendos recebidos)
3. **Destaques** (2-3 ativos para observar — positivos ou negativos)
4. **Tendência dos Últimos 30 dias** (com base nos snapshots)
5. **Recomendações Práticas** (2-3 ações concretas para a próxima semana)

Use markdown. Seja direto, prático e baseado nos dados fornecidos.`;

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Dados da carteira:\n\n${JSON.stringify(portfolioSummary, null, 2)}` },
            ],
          }),
        });

        if (!aiResp.ok) {
          const t = await aiResp.text();
          errors.push(`user ${u.id}: AI ${aiResp.status} ${t.slice(0, 200)}`);
          continue;
        }

        const aiJson = await aiResp.json();
        const content = aiJson.choices?.[0]?.message?.content as string | undefined;
        if (!content) { errors.push(`user ${u.id}: empty AI content`); continue; }

        const now = new Date();
        const title = reportType === "weekly"
          ? `Relatório Semanal — ${now.toLocaleDateString("pt-BR")}`
          : `Relatório Manual — ${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR")}`;

        const { error: insErr } = await admin.from("ai_reports").insert({
          user_id: u.id,
          title,
          content,
          report_type: reportType,
          portfolio_snapshot: {
            totalInvested,
            totalCurrent,
            difference: totalCurrent - totalInvested,
            assetsCount: assets.length,
            dividendsWeek,
          },
        });
        if (insErr) errors.push(`user ${u.id}: insert ${insErr.message}`);
        else processed++;
      } catch (e) {
        errors.push(`user ${u.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return new Response(JSON.stringify({ success: true, processed, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("weekly-ai-report error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
