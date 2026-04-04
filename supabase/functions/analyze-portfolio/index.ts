import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { assets } = await req.json();

    if (!assets || !Array.isArray(assets) || assets.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum ativo fornecido para análise." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const portfolioSummary = assets.map((a: any) => ({
      ticker: a.ticker,
      cotas: a.quantity,
      precoAtual: a.currentPrice,
      precoMedio: a.averagePrice,
      totalAtual: a.totalCurrent,
      totalInvestido: a.totalInvested,
      diferenca: a.difference,
      dy: a.dividendYield,
      pvp: a.pvp,
      rentMensal: a.monthlyProfitability,
      varCota: a.priceVariation,
      rating: a.rating,
      proporcao: a.portfolioProportion,
      varTotal: a.totalVariationPerShare,
    }));

    const systemPrompt = `Você é um analista financeiro especialista em fundos imobiliários (FIIs) e ações brasileiras. 
Analise a carteira do investidor e forneça insights acionáveis em português brasileiro.

Sua análise deve cobrir:
1. **Visão Geral da Carteira**: resumo do estado atual
2. **Ativos Destaque** (positivo e negativo): quais estão performando bem e quais precisam de atenção
3. **Distribuição**: se a carteira está concentrada demais em algum ativo e como diversificar melhor
4. **Oportunidades**: com base nos indicadores (P/VP, DY, variação), quais ativos parecem boas oportunidades de aporte
5. **Alertas**: ativos com indicadores preocupantes
6. **Sugestões de Ação**: 3-5 ações concretas que o investidor pode tomar

Use formatação markdown. Seja direto e prático. Não dê conselhos genéricos.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Analise minha carteira de investimentos:\n\n${JSON.stringify(portfolioSummary, null, 2)}`,
          },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos nas configurações do workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Erro ao consultar a IA." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("analyze-portfolio error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
