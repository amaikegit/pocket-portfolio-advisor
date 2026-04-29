import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface TableFilterPreset {
  id: string;
  name: string;
  filters: Record<string, string[]>;
}

const SCOPE = "portfolio_table";

export function useTableFilterPresets() {
  const { user } = useAuth();
  const [presets, setPresets] = useState<TableFilterPreset[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPresets = useCallback(async () => {
    if (!user) {
      setPresets([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("table_filter_presets")
      .select("id, name, filters")
      .eq("scope", SCOPE)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar filtros salvos");
    } else {
      setPresets(
        (data ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          filters: (p.filters as Record<string, string[]>) ?? {},
        })),
      );
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  const savePreset = async (name: string, filters: Record<string, string[]>) => {
    if (!user) return;
    const { error } = await supabase.from("table_filter_presets").insert({
      user_id: user.id,
      name,
      scope: SCOPE,
      filters,
    });
    if (error) {
      toast.error("Erro ao salvar filtro");
      return;
    }
    toast.success(`Filtro "${name}" salvo`);
    fetchPresets();
  };

  const updatePreset = async (id: string, filters: Record<string, string[]>) => {
    const { error } = await supabase
      .from("table_filter_presets")
      .update({ filters })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar filtro");
      return;
    }
    toast.success("Filtro atualizado");
    fetchPresets();
  };

  const deletePreset = async (id: string) => {
    const { error } = await supabase.from("table_filter_presets").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir filtro");
      return;
    }
    toast.success("Filtro excluído");
    fetchPresets();
  };

  return { presets, loading, savePreset, updatePreset, deletePreset };
}
