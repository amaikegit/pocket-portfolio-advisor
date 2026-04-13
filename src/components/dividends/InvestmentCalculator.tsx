import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calculator, DollarSign, TrendingUp, Percent } from "lucide-react";

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function InvestmentCalculator() {
  const [initial, setInitial] = useState("");
  const [rate, setRate] = useState("");
  const [monthly, setMonthly] = useState("");
  const [months, setMonths] = useState("");
  const [result, setResult] = useState<{
    investimentoInicial: number;
    investimentoContinuo: number;
    jurosObtidos: number;
    valorFinal: number;
  } | null>(null);

  const calculate = () => {
    const PV = parseFloat(initial.replace(",", ".")) || 0;
    const annualRate = (parseFloat(rate.replace(",", ".")) || 0) / 100;
    const PMT = parseFloat(monthly.replace(",", ".")) || 0;
    const nMonths = parseInt(months) || 0;

    if (nMonths <= 0) return;

    // Monthly rate
    const monthlyRate = annualRate / 12;

    // FV = FV(rate_annual, years, 0, -PV) + FV(rate_monthly, months, -PMT, 0, 0)
    // FV of lump sum: PV * (1 + annual_rate)^years
    // FV of annuity: PMT * (((1 + monthly_rate)^months - 1) / monthly_rate)
    // Using the exact Excel FV formula from user:
    // =FV(AF12;AF13;0;-AD12) + FV(AF12/AD14;AF13*AD14;-AD13;0;0)
    // AF12 = annual rate, AF13 = years (duration), AD12 = initial, AD14 = 12 (compound months), AD13 = monthly PMT
    // FV(rate, nper, pmt, pv, type)
    // FV(annualRate, years, 0, -PV) => PV * (1 + annualRate)^years
    // FV(annualRate/12, years*12, -PMT, 0, 0) => PMT * (((1+monthlyRate)^(years*12) - 1) / monthlyRate)

    const years = nMonths / 12;
    
    // FV of initial investment compounded annually then broken to match user formula
    // FV(rate, nper, pmt, pv) = -pv*(1+rate)^nper - pmt*(((1+rate)^nper - 1)/rate)
    // First part: FV(annualRate, years, 0, -PV) = PV * (1 + annualRate)^years
    const fvInitial = PV * Math.pow(1 + annualRate, years);

    // Second part: FV(monthlyRate, nMonths, -PMT, 0, 0) = PMT * (((1+monthlyRate)^nMonths - 1) / monthlyRate)
    let fvContinuous = 0;
    if (monthlyRate > 0) {
      fvContinuous = PMT * ((Math.pow(1 + monthlyRate, nMonths) - 1) / monthlyRate);
    } else {
      fvContinuous = PMT * nMonths;
    }

    const valorFinal = fvInitial + fvContinuous;
    const investimentoContinuo = PMT * nMonths;
    const jurosObtidos = valorFinal - PV - investimentoContinuo;

    setResult({
      investimentoInicial: PV,
      investimentoContinuo,
      jurosObtidos,
      valorFinal,
    });
  };

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
        <Button onClick={calculate} className="gap-2 mb-4">
          <Calculator className="h-4 w-4" />
          Calcular
        </Button>

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
