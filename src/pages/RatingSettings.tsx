import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RotateCcw, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { StarRating } from "@/components/StarRating";
import { useRatingSettings } from "@/hooks/useRatingSettings";
import { usePortfolio } from "@/hooks/usePortfolio";
import { computeRating, DEFAULT_RATING_SETTINGS, RatingSettings } from "@/lib/rating";
import { RatingCriterionKey } from "@/types/portfolio";

const CRITERIA: { key: RatingCriterionKey; label: string; description: string }[] = [
  { key: "valuation",           label: "Valuation (P/VP)",          description: "Quanto menor o P/VP, mais barato o ativo está em relação ao patrimônio." },
  { key: "dividendYield",       label: "Dividend Yield mensal",     description: "Premia ativos com maior rentabilidade mensal de proventos." },
  { key: "priceVsAverage",      label: "Posição vs preço médio",    description: "Pontua oportunidades quando o preço atual está abaixo do PM." },
  { key: "unrealizedPnL",       label: "Resultado não realizado",   description: "Considera o lucro/prejuízo atual em relação ao investido." },
  { key: "concentration",       label: "Concentração na carteira",  description: "Premia faixas saudáveis e penaliza concentração excessiva." },
  { key: "dividendConsistency", label: "Consistência de proventos", description: "Quantos meses dos últimos 12 o ativo pagou dividendos." },
];

export default function RatingSettingsPage() {
  const navigate = useNavigate();
  const { settings, save, resetDefaults, loading, saving } = useRatingSettings();
  const { calculatedAssets } = usePortfolio();
  const [draft, setDraft] = useState<RatingSettings>(settings);

  useEffect(() => { setDraft(settings); }, [settings]);

  const totalWeight = useMemo(
    () => CRITERIA.reduce((s, c) => s + (draft.enabledCriteria.includes(c.key) ? draft.weights[c.key] : 0), 0),
    [draft],
  );

  const previewAssets = useMemo(() => {
    if (calculatedAssets.length === 0) return [];
    const sorted = [...calculatedAssets].sort((a, b) => b.totalCurrent - a.totalCurrent);
    return sorted.slice(0, 3);
  }, [calculatedAssets]);

  const setWeight = (key: RatingCriterionKey, value: number) =>
    setDraft((d) => ({ ...d, weights: { ...d.weights, [key]: value } }));

  const setEnabled = (key: RatingCriterionKey, on: boolean) =>
    setDraft((d) => ({
      ...d,
      enabledCriteria: on
        ? Array.from(new Set([...d.enabledCriteria, key]))
        : d.enabledCriteria.filter((k) => k !== key),
    }));

  const setThreshold = (path: string[], value: number) =>
    setDraft((d) => {
      const next = JSON.parse(JSON.stringify(d)) as RatingSettings;
      let obj: any = next.thresholds;
      for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
      obj[path[path.length - 1]] = value;
      return next;
    });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="font-mono-display text-base sm:text-lg font-bold">
              Configurações de <span className="text-primary">Rating</span>
            </h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setDraft(DEFAULT_RATING_SETTINGS)}>
              <RotateCcw className="h-4 w-4" /> Restaurar padrão
            </Button>
            <Button className="gap-2" onClick={() => save(draft)} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Pesos dos critérios</span>
              <span className="text-xs font-normal text-muted-foreground">
                Total ativo: {totalWeight} (renormalizado para 100)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {CRITERIA.map((c) => {
              const isOn = draft.enabledCriteria.includes(c.key);
              return (
                <div key={c.key} className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Switch checked={isOn} onCheckedChange={(v) => setEnabled(c.key, v)} />
                        <Label className={`font-semibold ${!isOn ? "text-muted-foreground" : ""}`}>{c.label}</Label>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{c.description}</p>
                    </div>
                    <div className="text-right tabular-nums text-sm font-mono-display">
                      {draft.weights[c.key]}%
                    </div>
                  </div>
                  <Slider
                    value={[draft.weights[c.key]]}
                    min={0}
                    max={50}
                    step={1}
                    disabled={!isOn}
                    onValueChange={(v) => setWeight(c.key, v[0])}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Limiares</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <ThresholdGroup title="Valuation (P/VP)" hint="Menor é melhor. Faixas: excelente / bom / razoável.">
              <NumField label="Excelente <" value={draft.thresholds.valuation.excellent} step={0.05}
                onChange={(v) => setThreshold(["valuation", "excellent"], v)} />
              <NumField label="Bom <" value={draft.thresholds.valuation.good} step={0.05}
                onChange={(v) => setThreshold(["valuation", "good"], v)} />
              <NumField label="Razoável <" value={draft.thresholds.valuation.fair} step={0.05}
                onChange={(v) => setThreshold(["valuation", "fair"], v)} />
            </ThresholdGroup>

            <ThresholdGroup title="Dividend Yield mensal (%)" hint="Maior é melhor.">
              <NumField label="Excelente >" value={draft.thresholds.dividendYield.excellent} step={0.1}
                onChange={(v) => setThreshold(["dividendYield", "excellent"], v)} />
              <NumField label="Bom >" value={draft.thresholds.dividendYield.good} step={0.1}
                onChange={(v) => setThreshold(["dividendYield", "good"], v)} />
              <NumField label="Razoável >" value={draft.thresholds.dividendYield.fair} step={0.1}
                onChange={(v) => setThreshold(["dividendYield", "fair"], v)} />
            </ThresholdGroup>

            <ThresholdGroup title="Posição vs PM (%)" hint="Negativo = preço atual abaixo do PM (oportunidade).">
              <NumField label="Excelente <" value={draft.thresholds.priceVsAverage.excellent} step={1}
                onChange={(v) => setThreshold(["priceVsAverage", "excellent"], v)} />
              <NumField label="Bom <" value={draft.thresholds.priceVsAverage.good} step={1}
                onChange={(v) => setThreshold(["priceVsAverage", "good"], v)} />
              <NumField label="Razoável <" value={draft.thresholds.priceVsAverage.fair} step={1}
                onChange={(v) => setThreshold(["priceVsAverage", "fair"], v)} />
            </ThresholdGroup>

            <ThresholdGroup title="Concentração na carteira (%)" hint="Faixa ideal e tetos de alerta.">
              <NumField label="Ideal mín." value={draft.thresholds.concentration.idealMin} step={0.5}
                onChange={(v) => setThreshold(["concentration", "idealMin"], v)} />
              <NumField label="Ideal máx." value={draft.thresholds.concentration.idealMax} step={0.5}
                onChange={(v) => setThreshold(["concentration", "idealMax"], v)} />
              <NumField label="Alto até" value={draft.thresholds.concentration.highMax} step={1}
                onChange={(v) => setThreshold(["concentration", "highMax"], v)} />
              <NumField label="Baixo abaixo de" value={draft.thresholds.concentration.lowMin} step={0.5}
                onChange={(v) => setThreshold(["concentration", "lowMin"], v)} />
            </ThresholdGroup>

            <ThresholdGroup title="Consistência de dividendos (meses)" hint="Em 12 meses, quantos pagaram.">
              <NumField label="Excelente ≥" value={draft.thresholds.dividendConsistency.excellent} step={1}
                onChange={(v) => setThreshold(["dividendConsistency", "excellent"], v)} />
              <NumField label="Bom ≥" value={draft.thresholds.dividendConsistency.good} step={1}
                onChange={(v) => setThreshold(["dividendConsistency", "good"], v)} />
              <NumField label="Razoável ≥" value={draft.thresholds.dividendConsistency.fair} step={1}
                onChange={(v) => setThreshold(["dividendConsistency", "fair"], v)} />
            </ThresholdGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview ao vivo</CardTitle>
          </CardHeader>
          <CardContent>
            {previewAssets.length === 0 ? (
              <p className="text-sm text-muted-foreground">Adicione ativos à carteira para ver o preview.</p>
            ) : (
              <div className="space-y-2">
                {previewAssets.map((a) => {
                  const preview = computeRating(
                    {
                      pvp: a.pvp,
                      monthlyProfitability: a.monthlyProfitability,
                      priceVariation: a.priceVariation,
                      averagePrice: a.averagePrice,
                      difference: a.difference,
                      totalInvested: a.totalInvested,
                      portfolioProportion: a.portfolioProportion,
                      dividendMonthsLast12: 0, // not needed for relative preview
                    },
                    draft,
                  );
                  return (
                    <div key={a.id} className="flex items-center justify-between rounded-md border border-border p-3">
                      <div>
                        <div className="font-mono-display font-semibold text-primary">{a.ticker}</div>
                        <div className="text-xs text-muted-foreground">
                          score atual: {a.ratingScore.toFixed(0)} → novo: {preview.total.toFixed(0)}
                        </div>
                      </div>
                      <StarRating rating={preview.stars} breakdown={preview} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function ThresholdGroup({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <div className="font-semibold text-sm">{title}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

function NumField({
  label, value, step, onChange,
}: { label: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 text-sm"
      />
    </div>
  );
}