import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_RATING_SETTINGS,
  RatingSettings,
  RatingThresholds,
  RatingWeights,
} from "@/lib/rating";
import { RatingCriterionKey } from "@/types/portfolio";

function rowToSettings(row: any): RatingSettings {
  return {
    weights: { ...DEFAULT_RATING_SETTINGS.weights, ...(row?.weights ?? {}) } as RatingWeights,
    thresholds: {
      ...DEFAULT_RATING_SETTINGS.thresholds,
      ...(row?.thresholds ?? {}),
    } as RatingThresholds,
    enabledCriteria:
      Array.isArray(row?.enabled_criteria) && row.enabled_criteria.length > 0
        ? (row.enabled_criteria as RatingCriterionKey[])
        : DEFAULT_RATING_SETTINGS.enabledCriteria,
  };
}

export function useRatingSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<RatingSettings>(DEFAULT_RATING_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setSettings(DEFAULT_RATING_SETTINGS);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (supabase as any)
      .from("rating_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }: any) => {
        if (cancelled) return;
        if (error) {
          // Not fatal — fall back to defaults silently.
          setSettings(DEFAULT_RATING_SETTINGS);
        } else if (data) {
          setSettings(rowToSettings(data));
        } else {
          setSettings(DEFAULT_RATING_SETTINGS);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const save = useCallback(
    async (next: RatingSettings) => {
      if (!user) return;
      setSaving(true);
      const { error } = await (supabase as any)
        .from("rating_settings")
        .upsert(
          {
            user_id: user.id,
            weights: next.weights,
            thresholds: next.thresholds,
            enabled_criteria: next.enabledCriteria,
          },
          { onConflict: "user_id" },
        );
      setSaving(false);
      if (error) {
        toast({ title: "Erro ao salvar configurações", description: error.message, variant: "destructive" });
        return;
      }
      setSettings(next);
      toast({ title: "Configurações salvas" });
    },
    [user, toast],
  );

  const resetDefaults = useCallback(() => save(DEFAULT_RATING_SETTINGS), [save]);

  return { settings, setSettings, save, resetDefaults, loading, saving };
}