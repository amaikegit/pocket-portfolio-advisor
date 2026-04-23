

# Refinamento do sistema de Rating dos ativos

Hoje o rating é binário (3 critérios → 0–3 pontos → mapeado para 2/3/4/5 estrelas), nunca chega a 1, salta direto de 4 para 5 e usa limiares fixos no código. O plano abaixo torna a escala real (1–5), adiciona critérios mais ricos, permite pesos e deixa os limiares **configuráveis pelo usuário**.

## 1. Nova lógica de pontuação (escala real 1–5)

Substituir o cálculo em `src/lib/portfolio.ts → calculateAsset` por um motor baseado em **score ponderado 0–100** convertido em estrelas.

Critérios propostos (cada um devolve uma sub-nota 0–1, depois multiplicada pelo peso):

| Critério | Como medir | Peso padrão |
|---|---|---|
| **Valuation (P/VP)** | `pvp < 0.85` → 1.0 ; `0.85–1.0` → 0.7 ; `1.0–1.1` → 0.4 ; `>1.1` → 0.1 ; `pvp = 0` (sem dado) → neutro 0.5 | 25% |
| **Dividend Yield mensal** | `monthlyProfitability` em faixas: `>1.0%` → 1.0 ; `0.7–1.0` → 0.7 ; `0.4–0.7` → 0.4 ; `<0.4` → 0.1 | 25% |
| **Posição vs preço médio** | `priceVariation < -5%` → 1.0 (oportunidade) ; `-5–0%` → 0.7 ; `0–10%` → 0.5 ; `>10%` → 0.3 | 15% |
| **Lucro/prejuízo não realizado** | `difference / totalInvested`: positivo escala 0.5→1.0 ; negativo 0.5→0.0 | 15% |
| **Concentração na carteira** | `portfolioProportion`: 5–15% → 1.0 ; 15–25% → 0.6 ; >25% → 0.2 ; <2% → 0.5 | 10% |
| **Consistência de proventos** (novo) | nº de meses com dividendo nos últimos 12 (vem de `dividends`): 10–12 → 1.0 ; 6–9 → 0.6 ; 1–5 → 0.3 ; 0 → 0.0 | 10% |

Conversão final: `stars = clamp(round(score / 20), 1, 5)` — agora a escala usa **1 a 5 estrelas reais** e tem granularidade.

Cada ativo passa a expor também um `ratingBreakdown` com a contribuição de cada critério, para tooltip.

## 2. Limiares e pesos configuráveis pelo usuário

- Nova tabela **`rating_settings`** (1 linha por usuário) com colunas:
  `weights jsonb`, `thresholds jsonb`, `enabled_criteria text[]`, timestamps + RLS por `user_id`.
- Migração cria a linha default no primeiro acesso (ou lazy via upsert).
- Hook `useRatingSettings()` carrega/salva as configurações; `calculateAsset` recebe `settings` como segundo parâmetro (com fallback para defaults se ausente).

## 3. Tooltip explicativo no `StarRating`

`src/components/StarRating.tsx` ganha `breakdown?: RatingBreakdown` opcional. Ao passar o mouse, mostra:

```text
★★★★☆  (4.2 / 5 — score 84/100)
• Valuation (P/VP 0.92)         +18 / 25
• Dividend Yield (0.85%/mês)   +17 / 25
• Posição vs PM (-3%)          +10 / 15
• Resultado (+8%)              +12 / 15
• Concentração (12%)           +10 / 10
• Consistência (11/12 meses)    +9 / 10
```

Usa o `Tooltip` do shadcn/ui já presente no projeto. Em mobile, vira `Popover` no toque.

## 4. Página de configuração

Nova rota `/configuracoes/rating` (e atalho no menu) com:

- Sliders para os pesos (somam 100%, normalização automática).
- Inputs numéricos para os limiares de cada faixa.
- Switches para ligar/desligar critérios.
- Botão "Restaurar padrão".
- Preview ao vivo: tabela com 3 ativos da carteira mostrando como o rating muda conforme os pesos.

## 5. Integração com dividendos (critério de consistência)

`usePortfolio` passa a receber também a contagem de meses com dividendo por ticker (já temos `useDividends` paginado). Calculado uma vez por carregamento e injetado em `calculateAsset`.

## Detalhes técnicos

- **Arquivos a editar:** `src/lib/portfolio.ts`, `src/types/portfolio.ts` (adicionar `ratingScore`, `ratingBreakdown`), `src/components/StarRating.tsx`, `src/components/PortfolioTable.tsx` (passar breakdown).
- **Arquivos a criar:** `src/hooks/useRatingSettings.ts`, `src/lib/rating.ts` (motor isolado e testável), `src/pages/RatingSettings.tsx`, migração SQL para `rating_settings`.
- **Compatibilidade:** se `rating_settings` não existir para o usuário, usa defaults — nada quebra para usuários atuais.
- **Backend AI:** `analyze-portfolio` e `weekly-ai-report` continuam recebendo `rating` (agora 1–5 real) sem mudança de contrato; opcionalmente passamos `ratingScore` para enriquecer a análise.
- **Testes:** adicionar `src/test/rating.test.ts` cobrindo edge cases (sem P/VP, DY zero, concentração extrema, sem dividendos).

## Não incluído (para evitar escopo grande)

- Dados de mercado externos (liquidez, setor, volatilidade) — exigiria nova fonte; pode entrar numa fase 2.
- Histórico de rating ao longo do tempo — também fase 2 se quiser gráfico de evolução do score.

