export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      locations: {
        Row: { id: string; name: string; kind: 'production' | 'store' | 'hybrid'; is_leftovers_primary: boolean; created_at: string };
        Insert: { id?: string; name: string; kind?: 'production' | 'store' | 'hybrid'; is_leftovers_primary?: boolean; created_at?: string };
        Update: { id?: string; name?: string; kind?: 'production' | 'store' | 'hybrid'; is_leftovers_primary?: boolean; created_at?: string };
        Relationships: [];
      };
      products: {
        Row: { id: string; name: string; family: string | null; unit: string; is_weekend_special: boolean; is_christmas_special: boolean; is_active: boolean; created_at: string };
        Insert: { id?: string; name: string; family?: string | null; unit?: string; is_weekend_special?: boolean; is_christmas_special?: boolean; is_active?: boolean; created_at?: string };
        Update: { id?: string; name?: string; family?: string | null; unit?: string; is_weekend_special?: boolean; is_christmas_special?: boolean; is_active?: boolean; created_at?: string };
        Relationships: [];
      };
      sales_daily: {
        Row: { id: string; sale_date: string; location_id: string | null; location_name: string | null; product_id: string | null; product_name: string | null; sold_qty: number; revenue: number; created_at: string };
        Insert: { id?: string; sale_date: string; location_id?: string | null; location_name?: string | null; product_id?: string | null; product_name?: string | null; sold_qty: number; revenue: number; created_at?: string };
        Update: { id?: string; sale_date?: string; location_id?: string | null; location_name?: string | null; product_id?: string | null; product_name?: string | null; sold_qty?: number; revenue?: number; created_at?: string };
        Relationships: [];
      };
      daily_sessions: {
        Row: { id: string; location_id: string; session_date: string; status: 'open' | 'closed'; created_at: string; updated_at: string };
        Insert: { id?: string; location_id: string; session_date: string; status?: 'open' | 'closed'; created_at?: string; updated_at?: string };
        Update: { id?: string; location_id?: string; session_date?: string; status?: 'open' | 'closed'; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      daily_product_entries: {
        Row: { id: string; daily_session_id: string; product_id: string; saved_qty: number; discarded_qty: number; reason_code: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; daily_session_id: string; product_id: string; saved_qty?: number; discarded_qty?: number; reason_code?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; daily_session_id?: string; product_id?: string; saved_qty?: number; discarded_qty?: number; reason_code?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      product_costs: {
        Row: { id: string; product_id: string; valid_from: string; unit_cost: number; created_at: string };
        Insert: { id?: string; product_id: string; valid_from: string; unit_cost: number; created_at?: string };
        Update: { id?: string; product_id?: string; valid_from?: string; unit_cost?: number; created_at?: string };
        Relationships: [];
      };
      production_teams: {
        Row: { id: string; name: string; location_id: string | null; created_at: string };
        Insert: { id?: string; name: string; location_id?: string | null; created_at?: string };
        Update: { id?: string; name?: string; location_id?: string | null; created_at?: string };
        Relationships: [];
      };
      sales_raw: {
        Row: { id: number; source_file: string; row_data: Json; imported_at: string };
        Insert: { id?: number; source_file: string; row_data: Json; imported_at?: string };
        Update: { id?: number; source_file?: string; row_data?: Json; imported_at?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
