import { AssetCalculated } from "@/types/portfolio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const COLORS = [
  "hsl(142, 60%, 45%)",
  "hsl(38, 90%, 55%)",
  "hsl(200, 70%, 50%)",
  "hsl(280, 60%, 55%)",
  "hsl(0, 70%, 50%)",
  "hsl(170, 60%, 45%)",
  "hsl(320, 60%, 50%)",
  "hsl(60, 70%, 50%)",
  "hsl(220, 60%, 55%)",
  "hsl(100, 50%, 45%)",
  "hsl(30, 80%, 50%)",
  "hsl(250, 50%, 55%)",
  "hsl(150, 50%, 40%)",
  "hsl(10, 70%, 55%)",
  "hsl(190, 60%, 45%)",
  "hsl(340, 55%, 50%)",
];

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CustomTooltipPie = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-foreground">{d.name}</p>
      <p className="text-muted-foreground">{d.value.toFixed(2)}% da carteira</p>
      <p className="text-muted-foreground">{formatCurrency(d.payload.totalCurrent)}</p>
    </div>
  );
};

const CustomTooltipBar = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

interface Props {
  assets: AssetCalculated[];
}

export function PortfolioCharts({ assets }: Props) {
  if (assets.length === 0) return null;

  const pieData = assets
    .map((a) => ({
      name: a.ticker,
      value: parseFloat(a.portfolioProportion.toFixed(2)),
      totalCurrent: a.totalCurrent,
    }))
    .sort((a, b) => b.value - a.value);

  const barData = assets
    .map((a) => ({
      ticker: a.ticker,
      invested: a.totalInvested,
      current: a.totalCurrent,
      difference: a.difference,
    }))
    .sort((a, b) => b.current - a.current);

  const rentabilityData = assets
    .map((a) => ({
      ticker: a.ticker,
      rentabilidade: parseFloat(a.monthlyProfitability.toFixed(2)),
      variacao: parseFloat(a.priceVariation.toFixed(2)),
    }))
    .sort((a, b) => b.rentabilidade - a.rentabilidade);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Pie Chart - Composição */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono text-muted-foreground">
            Composição da Carteira
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={110}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                stroke="hsl(220, 20%, 7%)"
                strokeWidth={2}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltipPie />} />
              <Legend
                formatter={(value) => (
                  <span className="text-xs text-muted-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Bar Chart - Investido vs Atual */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono text-muted-foreground">
            Investido vs Valor Atual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
              <XAxis
                dataKey="ticker"
                tick={{ fill: "hsl(215, 15%, 50%)", fontSize: 10 }}
                axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
                tickLine={false}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fill: "hsl(215, 15%, 50%)", fontSize: 10 }}
                axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
                tickLine={false}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltipBar />} />
              <Legend
                formatter={(value) => (
                  <span className="text-xs text-muted-foreground">{value}</span>
                )}
              />
              <Bar dataKey="invested" name="Investido" fill="hsl(215, 15%, 50%)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="current" name="Atual" fill="hsl(142, 60%, 45%)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Bar Chart - Rentabilidade Mensal */}
      <Card className="bg-card border-border lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono text-muted-foreground">
            Rentabilidade Mensal (DY%) e Variação de Cota (R$)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={rentabilityData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
              <XAxis
                dataKey="ticker"
                tick={{ fill: "hsl(215, 15%, 50%)", fontSize: 10 }}
                axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
                tickLine={false}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fill: "hsl(215, 15%, 50%)", fontSize: 10 }}
                axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltipBar />} />
              <Legend
                formatter={(value) => (
                  <span className="text-xs text-muted-foreground">{value}</span>
                )}
              />
              <Bar dataKey="rentabilidade" name="Rent. Mensal (%)" fill="hsl(38, 90%, 55%)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="variacao" name="Variação Cota (R$)" fill="hsl(200, 70%, 50%)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
