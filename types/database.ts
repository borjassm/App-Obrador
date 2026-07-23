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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      daily_product_entries: {
        Row: {
          comment: string | null
          created_at: string
          daily_session_id: string
          discard_reason: string | null
          discarded_qty: number
          id: string
          product_id: string
          saved_qty: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          daily_session_id: string
          discard_reason?: string | null
          discarded_qty?: number
          id?: string
          product_id: string
          saved_qty?: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          daily_session_id?: string
          discard_reason?: string | null
          discarded_qty?: number
          id?: string
          product_id?: string
          saved_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_product_entries_daily_session_id_fkey"
            columns: ["daily_session_id"]
            isOneToOne: false
            referencedRelation: "daily_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_product_entries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          id: string
          location_id: string
          notes: string | null
          session_date: string
          status: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          location_id: string
          notes?: string | null
          session_date: string
          status?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          location_id?: string
          notes?: string | null
          session_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_sessions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          min_stock_level: number | null
          name: string
          unit: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          min_stock_level?: number | null
          name: string
          unit?: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          min_stock_level?: number | null
          name?: string
          unit?: string
        }
        Relationships: []
      }
      inventory_entries: {
        Row: {
          created_at: string | null
          entry_date: string
          id: string
          ingredient_id: string
          notes: string | null
          quantity: number
        }
        Insert: {
          created_at?: string | null
          entry_date?: string
          id?: string
          ingredient_id: string
          notes?: string | null
          quantity: number
        }
        Update: {
          created_at?: string | null
          entry_date?: string
          id?: string
          ingredient_id?: string
          notes?: string | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_entries_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      leftovers_raw: {
        Row: {
          created_at: string
          date: string
          discarded_qty: number
          id: number
          location_name: string
          product_name: string
        }
        Insert: {
          created_at?: string
          date: string
          discarded_qty: number
          id?: number
          location_name: string
          product_name: string
        }
        Update: {
          created_at?: string
          date?: string
          discarded_qty?: number
          id?: number
          location_name?: string
          product_name?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      prediction_accuracy: {
        Row: {
          actual_qty: number
          created_at: string | null
          error_pct: number | null
          holiday_factor: number | null
          id: string
          predicted_qty: number
          product_id: string
          target_date: string
          weather_factor: number | null
        }
        Insert: {
          actual_qty: number
          created_at?: string | null
          error_pct?: number | null
          holiday_factor?: number | null
          id?: string
          predicted_qty: number
          product_id: string
          target_date: string
          weather_factor?: number | null
        }
        Update: {
          actual_qty?: number
          created_at?: string | null
          error_pct?: number | null
          holiday_factor?: number | null
          id?: string
          predicted_qty?: number
          product_id?: string
          target_date?: string
          weather_factor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prediction_accuracy_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_weights: {
        Row: {
          product_id: string
          trend_weight: number
          updated_at: string | null
        }
        Insert: {
          product_id: string
          trend_weight?: number
          updated_at?: string | null
        }
        Update: {
          product_id?: string
          trend_weight?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prediction_weights_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_costs: {
        Row: {
          created_at: string
          id: string
          product_id: string
          unit_cost: number
          valid_from: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          unit_cost: number
          valid_from?: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          unit_cost?: number
          valid_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_process_config: {
        Row: {
          notes: string | null
          process_days: number
          product_id: string
          updated_at: string | null
        }
        Insert: {
          notes?: string | null
          process_days?: number
          product_id: string
          updated_at?: string | null
        }
        Update: {
          notes?: string | null
          process_days?: number
          product_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_process_config_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_entries: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          product_id: string
          production_date: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          production_date: string
          quantity?: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          production_date?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_entries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_plans: {
        Row: {
          confidence: string | null
          created_at: string | null
          holiday_factor: number | null
          id: string
          nave_qty: number
          override_at: string | null
          override_qty: number | null
          phase: string
          plan_date: string
          product_id: string
          suggested_qty: number
          tienda_qty: number
          weather_factor: number | null
        }
        Insert: {
          confidence?: string | null
          created_at?: string | null
          holiday_factor?: number | null
          id?: string
          nave_qty?: number
          override_at?: string | null
          override_qty?: number | null
          phase?: string
          plan_date: string
          product_id: string
          suggested_qty?: number
          tienda_qty?: number
          weather_factor?: number | null
        }
        Update: {
          confidence?: string | null
          created_at?: string | null
          holiday_factor?: number | null
          id?: string
          nave_qty?: number
          override_at?: string | null
          override_qty?: number | null
          phase?: string
          plan_date?: string
          product_id?: string
          suggested_qty?: number
          tienda_qty?: number
          weather_factor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "production_plans_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          display_order: number | null
          family: string | null
          id: string
          is_active: boolean
          is_custom: boolean | null
          is_obrador: boolean
          leftovers_family: string | null
          name: string
          sale_price: number | null
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          family?: string | null
          id?: string
          is_active?: boolean
          is_custom?: boolean | null
          is_obrador?: boolean
          leftovers_family?: string | null
          name: string
          sale_price?: number | null
        }
        Update: {
          created_at?: string
          display_order?: number | null
          family?: string | null
          id?: string
          is_active?: boolean
          is_custom?: boolean | null
          is_obrador?: boolean
          leftovers_family?: string | null
          name?: string
          sale_price?: number | null
        }
        Relationships: []
      }
      product_stock_counts: {
        Row: {
          count_date: string
          created_at: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
        }
        Insert: {
          count_date?: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          quantity?: number
        }
        Update: {
          count_date?: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_stock_counts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_daily: {
        Row: {
          created_at: string
          id: string
          location_id: string
          product_id: string
          revenue: number | null
          sale_date: string
          sold_qty: number
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          product_id: string
          revenue?: number | null
          sale_date: string
          sold_qty?: number
          source?: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          product_id?: string
          revenue?: number | null
          sale_date?: string
          sold_qty?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_daily_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_daily_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_raw: {
        Row: {
          created_at: string
          id: number
          location_name: string
          product_name: string
          revenue: number | null
          sale_date: string
          sold_qty: number
        }
        Insert: {
          created_at?: string
          id?: number
          location_name: string
          product_name: string
          revenue?: number | null
          sale_date: string
          sold_qty: number
        }
        Update: {
          created_at?: string
          id?: number
          location_name?: string
          product_name?: string
          revenue?: number | null
          sale_date?: string
          sold_qty?: number
        }
        Relationships: []
      }
    }
    Views: {
      v_ingredient_stock: {
        Row: {
          category: string | null
          current_stock: number | null
          id: string | null
          is_low: boolean | null
          last_count_date: string | null
          min_stock_level: number | null
          name: string | null
          unit: string | null
        }
        Relationships: []
      }
      v_product_stock: {
        Row: {
          current_stock: number | null
          family: string | null
          id: string | null
          last_count_date: string | null
          name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      analytics_latest_dates: {
        Args: Record<string, never>
        Returns: { latest_sale: string | null; latest_session: string | null; latest_production: string | null }[]
      }
      analytics_overview: {
        Args: { p_start: string; p_end: string; p_location?: string | null }
        Returns: { total_revenue: number; total_units: number; active_products: number; days_with_sales: number; avg_daily_revenue: number }[]
      }
      analytics_daily_series: {
        Args: { p_start: string; p_end: string; p_location?: string | null }
        Returns: { sale_date: string; revenue: number; units: number }[]
      }
      analytics_top_products: {
        Args: { p_start: string; p_end: string; p_limit?: number; p_location?: string | null }
        Returns: { product_id: string; name: string; family: string; units: number; revenue: number; revenue_share: number }[]
      }
      analytics_family_breakdown: {
        Args: { p_start: string; p_end: string; p_location?: string | null }
        Returns: { family: string; units: number; revenue: number; revenue_share: number }[]
      }
      analytics_weekday_pattern: {
        Args: { p_start: string; p_end: string; p_location?: string | null }
        Returns: { weekday: number; avg_revenue: number; avg_units: number }[]
      }
      analytics_waste: {
        Args: { p_start: string; p_end: string; p_limit?: number; p_location?: string | null }
        Returns: { product_id: string; name: string; family: string; discarded: number; saved: number; waste_cost: number; lost_revenue: number }[]
      }
      analytics_waste_series: {
        Args: { p_start: string; p_end: string; p_location?: string | null }
        Returns: { session_date: string; waste_qty: number; waste_cost: number }[]
      }
      analytics_product_series: {
        Args: { p_start: string; p_end: string; p_product: string; p_location?: string | null }
        Returns: { sale_date: string; revenue: number; units: number }[]
      }
      analytics_profitability: {
        Args: { p_start: string; p_end: string; p_limit?: number; p_location?: string | null }
        Returns: { product_id: string; name: string; family: string; units: number; revenue: number; unit_cost: number; est_margin: number; margin_pct: number }[]
      }
      sales_period_summary: {
        Args: { p_start: string; p_end: string; p_location?: string | null }
        Returns: { total_revenue: number; total_units: number; active_products: number; days_with_sales: number; avg_daily_revenue: number }[]
      }
      sales_period_series: {
        Args: { p_start: string; p_end: string; p_location?: string | null }
        Returns: { sale_date: string; revenue: number; units: number }[]
      }
      sales_period_products: {
        Args: { p_start: string; p_end: string; p_location?: string | null; p_limit?: number }
        Returns: { product_id: string; name: string; family: string; units: number; revenue: number; avg_units_per_day: number; revenue_share: number }[]
      }
      sales_first_date: {
        Args: Record<string, never>
        Returns: string | null
      }
      planning_suggestions: {
        Args: { p_date: string }
        Returns: { product_id: string; name: string; family: string; suggested_qty: number; base_recent: number; base_hist: number; carryover: number; trend_weight: number; confidence: string; samples: number }[]
      }
      planning_record_accuracy: {
        Args: { p_date: string }
        Returns: number
      }
      planning_accuracy_stats: {
        Args: { p_days?: number }
        Returns: { n: number; mape: number; hit_rate: number }[]
      }
      planning_location_split: {
        Args: Record<string, never>
        Returns: { product_id: string; nave_share: number }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
