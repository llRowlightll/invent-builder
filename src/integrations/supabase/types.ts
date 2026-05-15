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
      bom_items: {
        Row: {
          bom_id: string
          id: string
          notes: string | null
          product_id: string | null
          qty: number
          role: string | null
        }
        Insert: {
          bom_id: string
          id?: string
          notes?: string | null
          product_id?: string | null
          qty?: number
          role?: string | null
        }
        Update: {
          bom_id?: string
          id?: string
          notes?: string | null
          product_id?: string | null
          qty?: number
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bom_items_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      boms: {
        Row: {
          created_at: string
          id: string
          mode: string
          notes: string | null
          order_code: string | null
          session_id: string | null
          total_items: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode?: string
          notes?: string | null
          order_code?: string | null
          session_id?: string | null
          total_items?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          notes?: string | null
          order_code?: string | null
          session_id?: string | null
          total_items?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boms_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "config_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          country: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          slug: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          slug: string
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          description: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          description?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          description?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      competitor_map: {
        Row: {
          competitor_product_id: string
          id: string
          match_quality: string
          notes: string | null
          product_id: string
        }
        Insert: {
          competitor_product_id: string
          id?: string
          match_quality?: string
          notes?: string | null
          product_id: string
        }
        Update: {
          competitor_product_id?: string
          id?: string
          match_quality?: string
          notes?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_map_competitor_product_id_fkey"
            columns: ["competitor_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_map_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      config_bom_mapping: {
        Row: {
          bom_mapping_json: Json
          created_at: string
          id: string
          schema_id: string
        }
        Insert: {
          bom_mapping_json: Json
          created_at?: string
          id?: string
          schema_id: string
        }
        Update: {
          bom_mapping_json?: Json
          created_at?: string
          id?: string
          schema_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "config_bom_mapping_schema_id_fkey"
            columns: ["schema_id"]
            isOneToOne: true
            referencedRelation: "config_schemas"
            referencedColumns: ["schema_id"]
          },
        ]
      }
      config_rules: {
        Row: {
          created_at: string
          goto_step: string | null
          id: string
          if_json: Json
          message_en: string
          message_sv: string
          schema_id: string
          severity: string
        }
        Insert: {
          created_at?: string
          goto_step?: string | null
          id?: string
          if_json: Json
          message_en: string
          message_sv: string
          schema_id: string
          severity?: string
        }
        Update: {
          created_at?: string
          goto_step?: string | null
          id?: string
          if_json?: Json
          message_en?: string
          message_sv?: string
          schema_id?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "config_rules_schema_id_fkey"
            columns: ["schema_id"]
            isOneToOne: false
            referencedRelation: "config_schemas"
            referencedColumns: ["schema_id"]
          },
        ]
      }
      config_schemas: {
        Row: {
          category_slug: string | null
          created_at: string
          id: string
          schema_id: string
          schema_json: Json
          title_en: string
          title_sv: string
        }
        Insert: {
          category_slug?: string | null
          created_at?: string
          id?: string
          schema_id: string
          schema_json: Json
          title_en: string
          title_sv: string
        }
        Update: {
          category_slug?: string | null
          created_at?: string
          id?: string
          schema_id?: string
          schema_json?: Json
          title_en?: string
          title_sv?: string
        }
        Relationships: []
      }
      config_sessions: {
        Row: {
          created_at: string
          id: string
          inputs: Json
          mode: string
          order_code: string | null
          status: string
          template_slug: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inputs?: Json
          mode?: string
          order_code?: string | null
          status?: string
          template_slug?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inputs?: Json
          mode?: string
          order_code?: string | null
          status?: string
          template_slug?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      config_templates: {
        Row: {
          created_at: string
          id: string
          mode: string
          name: string
          payload: Json
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode?: string
          name: string
          payload: Json
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          name?: string
          payload?: Json
          slug?: string
        }
        Relationships: []
      }
      dataset_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          version: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          version: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          version?: string
        }
        Relationships: []
      }
      inquiries: {
        Row: {
          created_at: string
          email: string
          id: string
          locale: string
          message: string
          name: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          locale?: string
          message: string
          name: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          locale?: string
          message?: string
          name?: string
          status?: string
        }
        Relationships: []
      }
      pneumatic_mappings: {
        Row: {
          created_at: string
          id: string
          name: string
          rule: Json
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          rule: Json
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          rule?: Json
          slug?: string
        }
        Relationships: []
      }
      product_relations: {
        Row: {
          id: string
          notes: string | null
          product_id: string
          related_product_id: string
          relation_type: string
        }
        Insert: {
          id?: string
          notes?: string | null
          product_id: string
          related_product_id: string
          relation_type: string
        }
        Update: {
          id?: string
          notes?: string | null
          product_id?: string
          related_product_id?: string
          relation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_relations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_relations_related_product_id_fkey"
            columns: ["related_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_specs: {
        Row: {
          id: string
          key: string
          product_id: string
          unit: string | null
          value: string
        }
        Insert: {
          id?: string
          key: string
          product_id: string
          unit?: string | null
          value: string
        }
        Update: {
          id?: string
          key?: string
          product_id?: string
          unit?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_specs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          availability: string | null
          brand_id: string
          category_id: string
          created_at: string
          description: string | null
          family: string | null
          fieldbus: string | null
          id: string
          image_url: string | null
          ip_rating: string | null
          lead_time_days: number | null
          name: string
          sku: string
          status: string
          updated_at: string
          voltage: string | null
        }
        Insert: {
          availability?: string | null
          brand_id: string
          category_id: string
          created_at?: string
          description?: string | null
          family?: string | null
          fieldbus?: string | null
          id?: string
          image_url?: string | null
          ip_rating?: string | null
          lead_time_days?: number | null
          name: string
          sku: string
          status?: string
          updated_at?: string
          voltage?: string | null
        }
        Update: {
          availability?: string | null
          brand_id?: string
          category_id?: string
          created_at?: string
          description?: string | null
          family?: string | null
          fieldbus?: string | null
          id?: string
          image_url?: string | null
          ip_rating?: string | null
          lead_time_days?: number | null
          name?: string
          sku?: string
          status?: string
          updated_at?: string
          voltage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_items: {
        Row: {
          id: string
          product_id: string | null
          qty: number
          rfq_id: string
          role: string | null
        }
        Insert: {
          id?: string
          product_id?: string | null
          qty?: number
          rfq_id: string
          role?: string | null
        }
        Update: {
          id?: string
          product_id?: string | null
          qty?: number
          rfq_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_items_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      rfqs: {
        Row: {
          bom_id: string | null
          company: string | null
          contact_email: string | null
          contact_name: string | null
          created_at: string
          id: string
          message: string | null
          status: string
          user_id: string
        }
        Insert: {
          bom_id?: string | null
          company?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          message?: string | null
          status?: string
          user_id: string
        }
        Update: {
          bom_id?: string | null
          company?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          message?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfqs_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "boms"
            referencedColumns: ["id"]
          },
        ]
      }
      use_case_map: {
        Row: {
          category_slug: string
          created_at: string
          description_en: string | null
          description_sv: string | null
          id: string
          recommended_skus: string[]
          sort_order: number
          title_en: string
          title_sv: string
          use_case_slug: string
        }
        Insert: {
          category_slug: string
          created_at?: string
          description_en?: string | null
          description_sv?: string | null
          id?: string
          recommended_skus?: string[]
          sort_order?: number
          title_en: string
          title_sv: string
          use_case_slug: string
        }
        Update: {
          category_slug?: string
          created_at?: string
          description_en?: string | null
          description_sv?: string | null
          id?: string
          recommended_skus?: string[]
          sort_order?: number
          title_en?: string
          title_sv?: string
          use_case_slug?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      users_profile: {
        Row: {
          ai_mode: string
          created_at: string
          display_name: string | null
          locale: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_mode?: string
          created_at?: string
          display_name?: string | null
          locale?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_mode?: string
          created_at?: string
          display_name?: string | null
          locale?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "user"
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
    Enums: {
      app_role: ["admin", "editor", "user"],
    },
  },
} as const
