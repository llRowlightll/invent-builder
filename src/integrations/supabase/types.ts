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
          qty: number | null
          role: string | null
        }
        Insert: {
          bom_id: string
          id?: string
          notes?: string | null
          product_id?: string | null
          qty?: number | null
          role?: string | null
        }
        Update: {
          bom_id?: string
          id?: string
          notes?: string | null
          product_id?: string | null
          qty?: number | null
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
          created_at: string | null
          id: string
          mode: string | null
          notes: string | null
          order_code: string | null
          session_id: string | null
          total_items: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          mode?: string | null
          notes?: string | null
          order_code?: string | null
          session_id?: string | null
          total_items?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          mode?: string | null
          notes?: string | null
          order_code?: string | null
          session_id?: string | null
          total_items?: number | null
          user_id?: string
        }
        Relationships: []
      }
      brands: {
        Row: {
          country: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          slug: string
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          slug: string
        }
        Update: {
          country?: string | null
          created_at?: string | null
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
      company_profiles: {
        Row: {
          address_city: string | null
          address_country: string
          address_postal: string | null
          address_street: string | null
          company_name: string | null
          created_at: string
          customer_number: string | null
          display_name: string | null
          email: string | null
          employees: string | null
          id: string
          industry: string | null
          locale: string
          org_number: string | null
          phone: string | null
          profile_complete: boolean
          role: string | null
          score: number
          score_breakdown: Json
          score_tier: string
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          address_city?: string | null
          address_country?: string
          address_postal?: string | null
          address_street?: string | null
          company_name?: string | null
          created_at?: string
          customer_number?: string | null
          display_name?: string | null
          email?: string | null
          employees?: string | null
          id: string
          industry?: string | null
          locale?: string
          org_number?: string | null
          phone?: string | null
          profile_complete?: boolean
          role?: string | null
          score?: number
          score_breakdown?: Json
          score_tier?: string
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          address_city?: string | null
          address_country?: string
          address_postal?: string | null
          address_street?: string | null
          company_name?: string | null
          created_at?: string
          customer_number?: string | null
          display_name?: string | null
          email?: string | null
          employees?: string | null
          id?: string
          industry?: string | null
          locale?: string
          org_number?: string | null
          phone?: string | null
          profile_complete?: boolean
          role?: string | null
          score?: number
          score_breakdown?: Json
          score_tier?: string
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      competitor_map: {
        Row: {
          competitor_product_id: string
          id: string
          match_quality: string | null
          notes: string | null
          product_id: string
        }
        Insert: {
          competitor_product_id: string
          id?: string
          match_quality?: string | null
          notes?: string | null
          product_id: string
        }
        Update: {
          competitor_product_id?: string
          id?: string
          match_quality?: string | null
          notes?: string | null
          product_id?: string
        }
        Relationships: []
      }
      competitor_groups: {
        Row: {
          brand: string | null
          family_id: string | null
          group_id: string | null
          group_name: string | null
          id: number
          match_basis: string | null
          match_confidence: number | null
          notes: string | null
        }
        Insert: {
          brand?: string | null
          family_id?: string | null
          group_id?: string | null
          group_name?: string | null
          id?: number
          match_basis?: string | null
          match_confidence?: number | null
          notes?: string | null
        }
        Update: {
          brand?: string | null
          family_id?: string | null
          group_id?: string | null
          group_name?: string | null
          id?: number
          match_basis?: string | null
          match_confidence?: number | null
          notes?: string | null
        }
        Relationships: []
      }
      config_bom_mapping: {
        Row: {
          bom_mapping_json: Json
          created_at: string | null
          id: string
          schema_id: string
        }
        Insert: {
          bom_mapping_json: Json
          created_at?: string | null
          id?: string
          schema_id: string
        }
        Update: {
          bom_mapping_json?: Json
          created_at?: string | null
          id?: string
          schema_id?: string
        }
        Relationships: []
      }
      config_rules: {
        Row: {
          created_at: string | null
          goto_step: string | null
          id: string
          if_json: Json
          message_en: string
          message_sv: string
          schema_id: string
          severity: string | null
        }
        Insert: {
          created_at?: string | null
          goto_step?: string | null
          id?: string
          if_json: Json
          message_en: string
          message_sv: string
          schema_id: string
          severity?: string | null
        }
        Update: {
          created_at?: string | null
          goto_step?: string | null
          id?: string
          if_json?: Json
          message_en?: string
          message_sv?: string
          schema_id?: string
          severity?: string | null
        }
        Relationships: []
      }
      config_schemas: {
        Row: {
          category_slug: string | null
          created_at: string | null
          id: string
          schema_id: string
          schema_json: Json
          title_en: string
          title_sv: string
        }
        Insert: {
          category_slug?: string | null
          created_at?: string | null
          id?: string
          schema_id: string
          schema_json: Json
          title_en: string
          title_sv: string
        }
        Update: {
          category_slug?: string | null
          created_at?: string | null
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
          created_at: string | null
          id: string
          inputs: Json | null
          mode: string | null
          order_code: string | null
          status: string | null
          template_slug: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          inputs?: Json | null
          mode?: string | null
          order_code?: string | null
          status?: string | null
          template_slug?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          inputs?: Json | null
          mode?: string | null
          order_code?: string | null
          status?: string | null
          template_slug?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      config_templates: {
        Row: {
          created_at: string | null
          id: string
          mode: string | null
          name: string
          payload: Json
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          mode?: string | null
          name: string
          payload: Json
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          mode?: string | null
          name?: string
          payload?: Json
          slug?: string
        }
        Relationships: []
      }
      dataset_versions: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          version: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          version: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          version?: string
        }
        Relationships: []
      }
      inquiries: {
        Row: {
          created_at: string | null
          email: string
          id: string
          locale: string | null
          message: string
          name: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          locale?: string | null
          message: string
          name: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          locale?: string | null
          message?: string
          name?: string
          status?: string | null
        }
        Relationships: []
      }
      pneumatic_mappings: {
        Row: {
          created_at: string | null
          id: string
          name: string
          rule: Json
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          rule: Json
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          rule?: Json
          slug?: string
        }
        Relationships: []
      }
      product_docs: {
        Row: {
          doc_id: string
          doc_type: string | null
          family_id: string | null
          language: string | null
          notes: string | null
          url: string | null
        }
        Insert: {
          doc_id: string
          doc_type?: string | null
          family_id?: string | null
          language?: string | null
          notes?: string | null
          url?: string | null
        }
        Update: {
          doc_id?: string
          doc_type?: string | null
          family_id?: string | null
          language?: string | null
          notes?: string | null
          url?: string | null
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
        Relationships: []
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
        Relationships: []
      }
      products: {
        Row: {
          availability: string | null
          brand_id: string
          category_id: string
          created_at: string | null
          description: string | null
          family: string | null
          fieldbus: string | null
          id: string
          image_url: string | null
          ip_rating: string | null
          lead_time_days: number | null
          name: string
          sku: string
          status: string | null
          updated_at: string | null
          voltage: string | null
        }
        Insert: {
          availability?: string | null
          brand_id: string
          category_id: string
          created_at?: string | null
          description?: string | null
          family?: string | null
          fieldbus?: string | null
          id?: string
          image_url?: string | null
          ip_rating?: string | null
          lead_time_days?: number | null
          name: string
          sku: string
          status?: string | null
          updated_at?: string | null
          voltage?: string | null
        }
        Update: {
          availability?: string | null
          brand_id?: string
          category_id?: string
          created_at?: string | null
          description?: string | null
          family?: string | null
          fieldbus?: string | null
          id?: string
          image_url?: string | null
          ip_rating?: string | null
          lead_time_days?: number | null
          name?: string
          sku?: string
          status?: string | null
          updated_at?: string | null
          voltage?: string | null
        }
        Relationships: []
      }
      products_core: {
        Row: {
          brand: string
          category: string | null
          configurable: boolean | null
          docs_url: string | null
          family_id: string
          grade: string | null
          lead_time: string | null
          name: string | null
          notes: string | null
          pricing_mode: string | null
          product_type: string | null
          series: string | null
          short_desc: string | null
          sub_category: string | null
        }
        Insert: {
          brand: string
          category?: string | null
          configurable?: boolean | null
          docs_url?: string | null
          family_id: string
          grade?: string | null
          lead_time?: string | null
          name?: string | null
          notes?: string | null
          pricing_mode?: string | null
          product_type?: string | null
          series?: string | null
          short_desc?: string | null
          sub_category?: string | null
        }
        Update: {
          brand?: string
          category?: string | null
          configurable?: boolean | null
          docs_url?: string | null
          family_id?: string
          grade?: string | null
          lead_time?: string | null
          name?: string | null
          notes?: string | null
          pricing_mode?: string | null
          product_type?: string | null
          series?: string | null
          short_desc?: string | null
          sub_category?: string | null
        }
        Relationships: []
      }
      rfq_items: {
        Row: {
          id: string
          product_id: string | null
          qty: number | null
          rfq_id: string
          role: string | null
        }
        Insert: {
          id?: string
          product_id?: string | null
          qty?: number | null
          rfq_id: string
          role?: string | null
        }
        Update: {
          id?: string
          product_id?: string | null
          qty?: number | null
          rfq_id?: string
          role?: string | null
        }
        Relationships: []
      }
      rfqs: {
        Row: {
          bom_id: string | null
          company: string | null
          contact_email: string | null
          contact_name: string | null
          created_at: string | null
          id: string
          message: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          bom_id?: string | null
          company?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          bom_id?: string | null
          company?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      use_case_map: {
        Row: {
          category_slug: string
          created_at: string | null
          description_en: string | null
          description_sv: string | null
          id: string
          recommended_skus: string[] | null
          sort_order: number | null
          title_en: string
          title_sv: string
          use_case_slug: string
        }
        Insert: {
          category_slug: string
          created_at?: string | null
          description_en?: string | null
          description_sv?: string | null
          id?: string
          recommended_skus?: string[] | null
          sort_order?: number | null
          title_en: string
          title_sv: string
          use_case_slug: string
        }
        Update: {
          category_slug?: string
          created_at?: string | null
          description_en?: string | null
          description_sv?: string | null
          id?: string
          recommended_skus?: string[] | null
          sort_order?: number | null
          title_en?: string
          title_sv?: string
          use_case_slug?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      users_profile: {
        Row: {
          ai_mode: string | null
          created_at: string | null
          display_name: string | null
          locale: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_mode?: string | null
          created_at?: string | null
          display_name?: string | null
          locale?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_mode?: string | null
          created_at?: string | null
          display_name?: string | null
          locale?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_customer_score: {
        Args: {
          profile: Database["public"]["Tables"]["company_profiles"]["Row"]
        }
        Returns: Json
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
