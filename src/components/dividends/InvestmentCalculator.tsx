import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Calculator, DollarSign, TrendingUp, Percent } from "lucide-react";

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  defaultInitial?: number;
  defaultRate?: number;
}

export function InvestmentCalculator({ defaultInitial = 0, defaultRate = 0 }: Props) {
  const stored = useMemo(() => {
    try {
      const raw = localStorage.getItem("investCalc");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, []);

  const [initial, setInitial] = useState(stored?.initial ?? "");
  const [rate, setRate] = useState(stored?.rate ?? "");
  const [monthly, setMonthly] = useState(stored?.monthly ?? "");
  const [months, setMonths] = useState(stored?.months ?? "");
  const [initialized, setInitialized] = useState(!!stored);

  // Set defaults from portfolio once available (only if no stored values)
  useEffect(() => {
    if (!initialized && defaultInitial > 0) {
      setInitial(defaultInitial.toFixed(2).replace(".", ","));
      setRate(defaultRate.toFixed(2).replace(".", ","));
      setInitialized(true);
    }
  }, [defaultInitial, defaultRate, initialized]);

  // Persist to localStorage on change
  useEffect(() => {
    localStorage.setItem("investCalc", JSON.stringify({ initial, rate, monthly, months }));
  }, [initial, rate, monthly, months]);

  const result = useMemo(() => {
    const PV = parseFloat(initial.replace(",", ".")) || 0;
    const annualRate = (parseFloat(rate.replace(",", ".")) || 0) / 100;
    const PMT = parseFloat(monthly.replace(",", ".")) || 0;
    const nMonths = parseInt(months) || 0;

    if (nMonths <= 0) return null;

    const monthlyRate = annualRate / 12;
    const years = nMonths / 12;

    const fvInitial = PV * Math.pow(1 + annualRate, years);

    let fvContinuous = 0;
    if (monthlyRate > 0) {
      fvContinuous = PMT * ((Math.pow(1 + monthlyRate, nMonths) - 1) / monthlyRate);
    } else {
      fvContinuous = PMT * nMonths;
    }

    const valorFinal = fvInitial + fvContinuous;
    const investimentoContinuo = PMT * nMonths;
    const jurosObtidos = valorFinal - PV - investimentoContinuo;

    return {
      investimentoInicial: PV,
      investimentoContinuo,
      jurosObtidos,
      valorFinal,
    };
  }, [initial, rate, monthly, months]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-mono flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Calculadora de Investimento
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="text-xs text-muted-foreground">Valor Inicial (R$)</label>
            <Input
              placeholder="Ex: 10000"
              value={initial}
              onChange={(e) => setInitial(e.target.value)}
              className="font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Taxa de Juros Anual (%)</label>
            <Input
              placeholder="Ex: 11,13"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Investimento Mensal (R$)</label>
            <Input
              placeholder="Ex: 900"
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
              className="font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Duração (meses)</label>
            <Input
              placeholder="Ex: 12"
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              className="font-mono"
            />
          </div>
        </div>

        {result && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="bg-muted/30 border-border">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  Investimento Inicial
                </div>
                <p className="text-lg font-mono font-bold">{formatBRL(result.investimentoInicial)}</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/30 border-border">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Investimento Contínuo
                </div>
                <p className="text-lg font-mono font-bold">{formatBRL(result.investimentoContinuo)}</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/30 border-border">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Percent className="h-3.5 w-3.5" />
                  Juros Obtidos
                </div>
                <p className="text-lg font-mono font-bold text-primary">{formatBRL(result.jurosObtidos)}</p>
              </CardContent>
            </Card>
            <Card className="bg-primary/10 border-primary/30">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  Valor Final
                </div>
                <p className="text-xl font-mono font-bold text-primary">{formatBRL(result.valorFinal)}</p>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
