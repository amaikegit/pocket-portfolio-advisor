export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_reports: {
        Row: {
          content: string
          created_at: string
          id: string
          portfolio_snapshot: Json | null
          report_type: string
          title: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          portfolio_snapshot?: Json | null
          report_type?: string
          title: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          portfolio_snapshot?: Json | null
          report_type?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          created_at: string
          dedupe_key: string
          id: string
          message: string
          metadata: Json | null
          read: boolean
          severity: string
          ticker: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dedupe_key: string
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean
          severity?: string
          ticker?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean
          severity?: string
          ticker?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          average_price: number
          created_at: string
          current_price: number
          dividend_yield: number
          fii_segment: string | null
          fii_type: string | null
          id: string
          is_manual_price: boolean
          pvp: number
          quantity: number
          ticker: string
          total_invested: number
          updated_at: string
          user_id: string
        }
        Insert: {
          average_price?: number
          created_at?: string
          current_price?: number
          dividend_yield?: number
          fii_segment?: string | null
          fii_type?: string | null
          id?: string
          is_manual_price?: boolean
          pvp?: number
          quantity?: number
          ticker: string
          total_invested?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          average_price?: number
          created_at?: string
          current_price?: number
          dividend_yield?: number
          fii_segment?: string | null
          fii_type?: string | null
          id?: string
          is_manual_price?: boolean
          pvp?: number
          quantity?: number
          ticker?: string
          total_invested?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dividends: {
        Row: {
          amount: number
          created_at: string
          id: string
          month: number
          payment_date: string
          ticker: string
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          month: number
          payment_date?: string
          ticker: string
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          month?: number
          payment_date?: string
          ticker?: string
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      portfolio_snapshots: {
        Row: {
          created_at: string
          id: string
          snapshot_date: string
          total_current: number
          total_difference: number
          total_invested: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          snapshot_date?: string
          total_current?: number
          total_difference?: number
          total_invested?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          snapshot_date?: string
          total_current?: number
          total_difference?: number
          total_invested?: number
          user_id?: string
        }
        Relationships: []
      }
      rating_presets: {
        Row: {
          created_at: string
          enabled_criteria: string[]
          id: string
          name: string
          thresholds: Json
          updated_at: string
          user_id: string
          weights: Json
        }
        Insert: {
          created_at?: string
          enabled_criteria: string[]
          id?: string
          name: string
          thresholds: Json
          updated_at?: string
          user_id: string
          weights: Json
        }
        Update: {
          created_at?: string
          enabled_criteria?: string[]
          id?: string
          name?: string
          thresholds?: Json
          updated_at?: string
          user_id?: string
          weights?: Json
        }
        Relationships: []
      }
      rating_settings: {
        Row: {
          created_at: string
          enabled_criteria: string[]
          id: string
          thresholds: Json
          updated_at: string
          user_id: string
          weights: Json
        }
        Insert: {
          created_at?: string
          enabled_criteria?: string[]
          id?: string
          thresholds?: Json
          updated_at?: string
          user_id: string
          weights?: Json
        }
        Update: {
          created_at?: string
          enabled_criteria?: string[]
          id?: string
          thresholds?: Json
          updated_at?: string
          user_id?: string
          weights?: Json
        }
        Relationships: []
      }
      report_snapshots: {
        Row: {
          created_at: string
          delta_current: number | null
          delta_dividends_week: number | null
          delta_rentabilidade_pct: number | null
          dividends_week_count: number
          dividends_week_total: number
          id: string
          previous_snapshot_id: string | null
          rentabilidade_pct: number
          report_id: string | null
          report_type: string
          total_current: number
          total_invested: number
          user_id: string
        }
        Insert: {
          created_at?: string
          delta_current?: number | null
          delta_dividends_week?: number | null
          delta_rentabilidade_pct?: number | null
          dividends_week_count?: number
          dividends_week_total?: number
          id?: string
          previous_snapshot_id?: string | null
          rentabilidade_pct?: number
          report_id?: string | null
          report_type?: string
          total_current?: number
          total_invested?: number
          user_id: string
        }
        Update: {
          created_at?: string
          delta_current?: number | null
          delta_dividends_week?: number | null
          delta_rentabilidade_pct?: number | null
          dividends_week_count?: number
          dividends_week_total?: number
          id?: string
          previous_snapshot_id?: string | null
          rentabilidade_pct?: number
          report_id?: string | null
          report_type?: string
          total_current?: number
          total_invested?: number
          user_id?: string
        }
        Relationships: []
      }
      table_filter_presets: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string
          scope: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          name: string
          scope?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          scope?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_bot_state: {
        Row: {
          id: number
          update_offset: number
          updated_at: string
        }
        Insert: {
          id: number
          update_offset?: number
          updated_at?: string
        }
        Update: {
          id?: number
          update_offset?: number
          updated_at?: string
        }
        Relationships: []
      }
      telegram_link_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      telegram_links: {
        Row: {
          alerts_enabled: boolean
          chat_id: number
          created_at: string
          first_name: string | null
          id: string
          reports_enabled: boolean
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          alerts_enabled?: boolean
          chat_id: number
          created_at?: string
          first_name?: string | null
          id?: string
          reports_enabled?: boolean
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          alerts_enabled?: boolean
          chat_id?: number
          created_at?: string
          first_name?: string | null
          id?: string
          reports_enabled?: boolean
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      telegram_outbox: {
        Row: {
          attempts: number
          chat_id: number
          created_at: string
          id: string
          last_error: string | null
          parse_mode: string | null
          sent_at: string | null
          status: string
          text: string
          user_id: string
        }
        Insert: {
          attempts?: number
          chat_id: number
          created_at?: string
          id?: string
          last_error?: string | null
          parse_mode?: string | null
          sent_at?: string | null
          status?: string
          text: string
          user_id: string
        }
        Update: {
          attempts?: number
          chat_id?: number
          created_at?: string
          id?: string
          last_error?: string | null
          parse_mode?: string | null
          sent_at?: string | null
          status?: string
          text?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          asset_type: string
          created_at: string
          date: string
          id: string
          other_costs: number
          price: number
          quantity: number
          ticker: string
          total: number
          type: string
          user_id: string
        }
        Insert: {
          asset_type: string
          created_at?: string
          date: string
          id?: string
          other_costs?: number
          price: number
          quantity: number
          ticker: string
          total?: number
          type: string
          user_id: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          date?: string
          id?: string
          other_costs?: number
          price?: number
          quantity?: number
          ticker?: string
          total?: number
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          id: string
          monthly_dividend_goal: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          monthly_dividend_goal?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          monthly_dividend_goal?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
