import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { RatingSettings } from "@/lib/rating";
import { RatingCriterionKey } from "@/types/portfolio";

export interface CustomPreset {
  id: string;
  name: string;
  settings: RatingSettings;
}

function rowToPreset(row: any): CustomPreset {
  return {
    id: row.id,
    name: row.name,
    settings: {
      weights: row.weights,
      thresholds: row.thresholds,
      enabledCriteria: row.enabled_criteria as RatingCriterionKey[],
    },
  };
}

export function useRatingPresets() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [presets, setPresets] = useState<CustomPreset[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) {
      setPresets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("rating_presets")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (!error && data) setPresets(data.map(rowToPreset));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  const savePreset = useCallback(
    async (name: string, settings: RatingSettings) => {
      if (!user) return;
      const trimmed = name.trim();
      if (!trimmed) {
        toast({ title: "Informe um nome para o preset", variant: "destructive" });
        return;
      }
      const { error } = await (supabase as any).from("rating_presets").insert({
        user_id: user.id,
        name: trimmed,
        weights: settings.weights,
        thresholds: settings.thresholds,
        enabled_criteria: settings.enabledCriteria,
      });
      if (error) {
        toast({ title: "Erro ao salvar preset", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: `Preset "${trimmed}" salvo` });
      await reload();
    },
    [user, reload, toast],
  );

  const deletePreset = useCallback(
    async (id: string) => {
      const { error } = await (supabase as any).from("rating_presets").delete().eq("id", id);
      if (error) {
        toast({ title: "Erro ao excluir preset", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Preset removido" });
      await reload();
    },
    [reload, toast],
  );

  return { presets, loading, savePreset, deletePreset, reload };
}
