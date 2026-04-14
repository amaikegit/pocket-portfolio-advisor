import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Target, Pencil, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  currentMonthTotal: number;
}

export function MonthlyGoal({ currentMonthTotal }: Props) {
  const { user } = useAuth();
  const [goal, setGoal] = useState(0);
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const loadGoal = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_settings")
      .select("monthly_dividend_goal")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) setGoal(Number(data.monthly_dividend_goal));
  }, [user]);

  useEffect(() => { loadGoal(); }, [loadGoal]);

  const saveGoal = async () => {
    if (!user) return;
    const value = parseFloat(inputValue.replace(",", ".")) || 0;
    const { data } = await supabase
      .from("user_settings")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      await supabase.from("user_settings").update({ monthly_dividend_goal: value }).eq("user_id", user.id);
    } else {
      await supabase.from("user_settings").insert({ user_id: user.id, monthly_dividend_goal: value });
    }
    setGoal(value);
    setEditing(false);
  };

  const pct = goal > 0 ? Math.min((currentMonthTotal / goal) * 100, 100) : 0;
  const reached = goal > 0 && currentMonthTotal >= goal;

  return (
    <Card className={reached ? "border-primary/50 bg-primary/5" : ""}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Target className="h-3.5 w-3.5" />
            Meta Mensal
          </div>
          {!editing && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setInputValue(goal > 0 ? goal.toString().replace(".", ",") : ""); setEditing(true); }}>
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>

        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              placeholder="Ex: 500"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="h-8 font-mono text-sm"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && saveGoal()}
            />
            <Button size="icon" className="h-8 w-8 shrink-0" onClick={saveGoal}>
              <Check className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : goal > 0 ? (
          <>
            <div className="flex items-baseline justify-between mb-1.5">
              <p className="text-lg font-mono font-bold">
                {formatBRL(currentMonthTotal)}
                <span className="text-xs text-muted-foreground font-normal ml-1">/ {formatBRL(goal)}</span>
              </p>
              <span className={`text-xs font-mono font-bold ${reached ? "text-primary" : "text-muted-foreground"}`}>
                {pct.toFixed(0)}%
              </span>
            </div>
            <Progress value={pct} className="h-2" />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Clique no lápis para definir sua meta
          </p>
        )}
      </CardContent>
    </Card>
  );
}
