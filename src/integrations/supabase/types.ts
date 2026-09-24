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
      advisor_contacts: {
        Row: {
          company: string | null
          created_at: string | null
          email: string
          handled: boolean | null
          id: string
          locale: string | null
          message: string
          name: string
          use_case: string | null
          user_id: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          email: string
          handled?: boolean | null
          id?: string
          locale?: string | null
          message: string
          name: string
          use_case?: string | null
          user_id?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          email?: string
          handled?: boolean | null
          id?: string
          locale?: string | null
          message?: string
          name?: string
          use_case?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      assemblies: {
        Row: {
          brand: string
          category: string
          created_at: string | null
          description: string | null
          exploded_url: string | null
          id: string
          image_url: string | null
          model_number: string | null
          name: string
          notes: string | null
          slug: string
          standard: string | null
          subcategory: string | null
          updated_at: string | null
        }
        Insert: {
          brand: string
          category: string
          created_at?: string | null
          description?: string | null
          exploded_url?: string | null
          id?: string
          image_url?: string | null
          model_number?: string | null
          name: string
          notes?: string | null
          slug: string
          standard?: string | null
          subcategory?: string | null
          updated_at?: string | null
        }
        Update: {
          brand?: string
          category?: string
          created_at?: string | null
          description?: string | null
          exploded_url?: string | null
          id?: string
          image_url?: string | null
          model_number?: string | null
          name?: string
          notes?: string | null
          slug?: string
          standard?: string | null
          subcategory?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      assembly_parts: {
        Row: {
          alt_part_number: string | null
          assembly_id: string
          created_at: string | null
          description: string | null
          hotspot_x: number | null
          hotspot_y: number | null
          id: string
          is_orderable: boolean
          is_service_item: boolean
          lead_time_days: number | null
          material: string | null
          notes: string | null
          part_name: string
          part_number: string | null
          part_type: string
          position_label: string | null
          position_number: number
          product_family: string | null
          product_sku_ref: string | null
          quantity: number
          service_category: string | null
        }
        Insert: {
          alt_part_number?: string | null
          assembly_id: string
          created_at?: string | null
          description?: string | null
          hotspot_x?: number | null
          hotspot_y?: number | null
          id?: string
          is_orderable?: boolean
          is_service_item?: boolean
          lead_time_days?: number | null
          material?: string | null
          notes?: string | null
          part_name: string
          part_number?: string | null
          part_type?: string
          position_label?: string | null
          position_number: number
          product_family?: string | null
          product_sku_ref?: string | null
          quantity?: number
          service_category?: string | null
        }
        Update: {
          alt_part_number?: string | null
          assembly_id?: string
          created_at?: string | null
          description?: string | null
          hotspot_x?: number | null
          hotspot_y?: number | null
          id?: string
          is_orderable?: boolean
          is_service_item?: boolean
          lead_time_days?: number | null
          material?: string | null
          notes?: string | null
          part_name?: string
          part_number?: string | null
          part_type?: string
          position_label?: string | null
          position_number?: number
          product_family?: string | null
          product_sku_ref?: string | null
          quantity?: number
          service_category?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assembly_parts_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          ts: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          ts?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          ts?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bom_connections: {
        Row: {
          bom_id: string
          created_at: string
          from_item_id: string
          id: string
          notes: string | null
          relation_type: string
          to_item_id: string
        }
        Insert: {
          bom_id: string
          created_at?: string
          from_item_id: string
          id?: string
          notes?: string | null
          relation_type: string
          to_item_id: string
        }
        Update: {
          bom_id?: string
          created_at?: string
          from_item_id?: string
          id?: string
          notes?: string | null
          relation_type?: string
          to_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_connections_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_connections_from_item_id_fkey"
            columns: ["from_item_id"]
            isOneToOne: false
            referencedRelation: "bom_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_connections_to_item_id_fkey"
            columns: ["to_item_id"]
            isOneToOne: false
            referencedRelation: "bom_items"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_items: {
        Row: {
          bom_id: string
          id: string
          notes: string | null
          product_id: string | null
          qty: number | null
          reason: string | null
          role: string | null
          sku: string | null
          sort_order: number | null
          subsystem: string | null
        }
        Insert: {
          bom_id: string
          id?: string
          notes?: string | null
          product_id?: string | null
          qty?: number | null
          reason?: string | null
          role?: string | null
          sku?: string | null
          sort_order?: number | null
          subsystem?: string | null
        }
        Update: {
          bom_id?: string
          id?: string
          notes?: string | null
          product_id?: string | null
          qty?: number | null
          reason?: string | null
          role?: string | null
          sku?: string | null
          sort_order?: number | null
          subsystem?: string | null
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
          {
            foreignKeyName: "bom_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_priced"
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
      claims: {
        Row: {
          admin_note: string | null
          claim_type: string | null
          contact_email: string | null
          created_at: string | null
          description: string
          id: string
          order_ref: string | null
          resolution_note: string | null
          sku: string | null
          status: string | null
          title: string
          updated_at: string | null
          urgency: string | null
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          claim_type?: string | null
          contact_email?: string | null
          created_at?: string | null
          description: string
          id?: string
          order_ref?: string | null
          resolution_note?: string | null
          sku?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          urgency?: string | null
          user_id: string
        }
        Update: {
          admin_note?: string | null
          claim_type?: string | null
          contact_email?: string | null
          created_at?: string | null
          description?: string
          id?: string
          order_ref?: string | null
          resolution_note?: string | null
          sku?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          urgency?: string | null
          user_id?: string
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
        Relationships: [
          {
            foreignKeyName: "competitor_groups_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "products_core"
            referencedColumns: ["family_id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "competitor_map_competitor_product_id_fkey"
            columns: ["competitor_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_map_competitor_product_id_fkey"
            columns: ["competitor_product_id"]
            isOneToOne: false
            referencedRelation: "products_priced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_map_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_map_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_priced"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "config_bom_mapping_schema_id_fkey1"
            columns: ["schema_id"]
            isOneToOne: true
            referencedRelation: "config_schemas"
            referencedColumns: ["schema_id"]
          },
        ]
      }
      config_bom_mapping_old: {
        Row: {
          bom_mapping_json: Json | null
          schema_id: string
        }
        Insert: {
          bom_mapping_json?: Json | null
          schema_id: string
        }
        Update: {
          bom_mapping_json?: Json | null
          schema_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "config_bom_mapping_schema_id_fkey"
            columns: ["schema_id"]
            isOneToOne: true
            referencedRelation: "config_schemas_old"
            referencedColumns: ["schema_id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "config_rules_schema_id_fkey1"
            columns: ["schema_id"]
            isOneToOne: false
            referencedRelation: "config_schemas"
            referencedColumns: ["schema_id"]
          },
        ]
      }
      config_rules_old: {
        Row: {
          goto_step: number | null
          if_json: Json | null
          message_en: string | null
          message_sv: string | null
          rule_id: string
          schema_id: string | null
          severity: string | null
        }
        Insert: {
          goto_step?: number | null
          if_json?: Json | null
          message_en?: string | null
          message_sv?: string | null
          rule_id: string
          schema_id?: string | null
          severity?: string | null
        }
        Update: {
          goto_step?: number | null
          if_json?: Json | null
          message_en?: string | null
          message_sv?: string | null
          rule_id?: string
          schema_id?: string | null
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "config_rules_schema_id_fkey"
            columns: ["schema_id"]
            isOneToOne: false
            referencedRelation: "config_schemas_old"
            referencedColumns: ["schema_id"]
          },
        ]
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
      config_schemas_old: {
        Row: {
          family_id: string | null
          schema_id: string
          schema_json: Json | null
          title: string | null
        }
        Insert: {
          family_id?: string | null
          schema_id: string
          schema_json?: Json | null
          title?: string | null
        }
        Update: {
          family_id?: string | null
          schema_id?: string
          schema_json?: Json | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "config_schemas_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "products_core"
            referencedColumns: ["family_id"]
          },
        ]
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
      configurator_families: {
        Row: {
          category_slug: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          order_code_template: string | null
          rules_schema_id: string | null
          slug: string
          standard: string | null
          stroke_max_mm: number | null
          stroke_min_mm: number | null
          title: string
        }
        Insert: {
          category_slug: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          order_code_template?: string | null
          rules_schema_id?: string | null
          slug: string
          standard?: string | null
          stroke_max_mm?: number | null
          stroke_min_mm?: number | null
          title: string
        }
        Update: {
          category_slug?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          order_code_template?: string | null
          rules_schema_id?: string | null
          slug?: string
          standard?: string | null
          stroke_max_mm?: number | null
          stroke_min_mm?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "configurator_families_rules_schema_id_fkey"
            columns: ["rules_schema_id"]
            isOneToOne: false
            referencedRelation: "config_schemas"
            referencedColumns: ["schema_id"]
          },
        ]
      }
      configurator_param_values: {
        Row: {
          code: string
          description: string | null
          id: string
          label: string
          param_id: string | null
          sort_order: number | null
        }
        Insert: {
          code: string
          description?: string | null
          id?: string
          label: string
          param_id?: string | null
          sort_order?: number | null
        }
        Update: {
          code?: string
          description?: string | null
          id?: string
          label?: string
          param_id?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "configurator_param_values_param_id_fkey"
            columns: ["param_id"]
            isOneToOne: false
            referencedRelation: "configurator_params"
            referencedColumns: ["id"]
          },
        ]
      }
      configurator_params: {
        Row: {
          family_id: string | null
          id: string
          label: string
          max_value: number | null
          min_value: number | null
          param_key: string
          param_type: string
          required: boolean | null
          show_code: boolean
          sort_order: number | null
        }
        Insert: {
          family_id?: string | null
          id?: string
          label: string
          max_value?: number | null
          min_value?: number | null
          param_key: string
          param_type: string
          required?: boolean | null
          show_code?: boolean
          sort_order?: number | null
        }
        Update: {
          family_id?: string | null
          id?: string
          label?: string
          max_value?: number | null
          min_value?: number | null
          param_key?: string
          param_type?: string
          required?: boolean | null
          show_code?: boolean
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "configurator_params_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "configurator_families"
            referencedColumns: ["id"]
          },
        ]
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
      document_number_counters: {
        Row: {
          last_used: number
          prefix: string
          year: number
        }
        Insert: {
          last_used?: number
          prefix?: string
          year: number
        }
        Update: {
          last_used?: number
          prefix?: string
          year?: number
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount_ex_vat: number
          category: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string
          expense_date: string
          id: string
          supplier: string | null
          vat_amount: number
        }
        Insert: {
          amount_ex_vat?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description: string
          expense_date?: string
          id?: string
          supplier?: string | null
          vat_amount?: number
        }
        Update: {
          amount_ex_vat?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          expense_date?: string
          id?: string
          supplier?: string | null
          vat_amount?: number
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
      integration_logs: {
        Row: {
          created_at: string
          error: string | null
          event: string
          id: string
          payload: Json | null
          ref_id: string | null
          response: Json | null
          source: string
          success: boolean
        }
        Insert: {
          created_at?: string
          error?: string | null
          event: string
          id?: string
          payload?: Json | null
          ref_id?: string | null
          response?: Json | null
          source: string
          success?: boolean
        }
        Update: {
          created_at?: string
          error?: string | null
          event?: string
          id?: string
          payload?: Json | null
          ref_id?: string | null
          response?: Json | null
          source?: string
          success?: boolean
        }
        Relationships: []
      }
      knowledge_chunks: {
        Row: {
          brand: string | null
          chunk_index: number
          content: string
          content_tsv: unknown
          created_at: string | null
          embedding: string | null
          id: string
          product_family: string | null
          source_file: string
        }
        Insert: {
          brand?: string | null
          chunk_index: number
          content: string
          content_tsv?: unknown
          created_at?: string | null
          embedding?: string | null
          id?: string
          product_family?: string | null
          source_file: string
        }
        Update: {
          brand?: string | null
          chunk_index?: number
          content?: string
          content_tsv?: unknown
          created_at?: string | null
          embedding?: string | null
          id?: string
          product_family?: string | null
          source_file?: string
        }
        Relationships: []
      }
      knowledge_doc_families: {
        Row: {
          doc_title: string | null
          family_slug: string
          source_file: string
        }
        Insert: {
          doc_title?: string | null
          family_slug: string
          source_file: string
        }
        Update: {
          doc_title?: string | null
          family_slug?: string
          source_file?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_doc_families_family_slug_fkey"
            columns: ["family_slug"]
            isOneToOne: false
            referencedRelation: "configurator_families"
            referencedColumns: ["slug"]
          },
        ]
      }
      order_items: {
        Row: {
          brand: string | null
          created_at: string
          currency: string
          id: string
          intended_supplier_id: string | null
          lead_time_days: number | null
          line_no: number
          line_total_ex_vat: number | null
          name: string
          note: string | null
          order_id: string
          product_id: string | null
          qty: number
          sku: string
          status: string
          unit_price_ex_vat: number | null
          updated_at: string
          vat_rate: number
        }
        Insert: {
          brand?: string | null
          created_at?: string
          currency?: string
          id?: string
          intended_supplier_id?: string | null
          lead_time_days?: number | null
          line_no: number
          line_total_ex_vat?: number | null
          name: string
          note?: string | null
          order_id: string
          product_id?: string | null
          qty: number
          sku: string
          status?: string
          unit_price_ex_vat?: number | null
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          brand?: string | null
          created_at?: string
          currency?: string
          id?: string
          intended_supplier_id?: string | null
          lead_time_days?: number | null
          line_no?: number
          line_total_ex_vat?: number | null
          name?: string
          note?: string | null
          order_id?: string
          product_id?: string | null
          qty?: number
          sku?: string
          status?: string
          unit_price_ex_vat?: number | null
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_intended_supplier_id_fkey"
            columns: ["intended_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_priced"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          order_id: string
          order_item_id: string | null
          payload: Json
          source: string
          to_status: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          order_id: string
          order_item_id?: string | null
          payload?: Json
          source?: string
          to_status: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          order_id?: string
          order_item_id?: string | null
          payload?: Json
          source?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_events_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          carrier: string | null
          created_at: string
          currency: string
          customer_company: string | null
          customer_email: string
          customer_name: string
          customer_org_nr: string | null
          delivered_at: string | null
          estimated_delivery: string | null
          fortnox_invoice_id: string | null
          id: string
          idempotency_key: string | null
          internal_notes: string | null
          invoice_date: string | null
          invoice_due_date: string | null
          invoice_number: string | null
          invoice_url: string | null
          items: Json
          order_number: string | null
          paid_at: string | null
          payment_status: string
          peppol_id: string | null
          po_number: string | null
          project_id: string | null
          rfq_id: string | null
          shipped_at: string | null
          status: string
          total_ex_vat: number | null
          total_inc_vat: number | null
          tracking_number: string | null
          updated_at: string
          user_id: string | null
          vat_rate: number
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          currency?: string
          customer_company?: string | null
          customer_email: string
          customer_name: string
          customer_org_nr?: string | null
          delivered_at?: string | null
          estimated_delivery?: string | null
          fortnox_invoice_id?: string | null
          id?: string
          idempotency_key?: string | null
          internal_notes?: string | null
          invoice_date?: string | null
          invoice_due_date?: string | null
          invoice_number?: string | null
          invoice_url?: string | null
          items?: Json
          order_number?: string | null
          paid_at?: string | null
          payment_status?: string
          peppol_id?: string | null
          po_number?: string | null
          project_id?: string | null
          rfq_id?: string | null
          shipped_at?: string | null
          status?: string
          total_ex_vat?: number | null
          total_inc_vat?: number | null
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
          vat_rate?: number
        }
        Update: {
          carrier?: string | null
          created_at?: string
          currency?: string
          customer_company?: string | null
          customer_email?: string
          customer_name?: string
          customer_org_nr?: string | null
          delivered_at?: string | null
          estimated_delivery?: string | null
          fortnox_invoice_id?: string | null
          id?: string
          idempotency_key?: string | null
          internal_notes?: string | null
          invoice_date?: string | null
          invoice_due_date?: string | null
          invoice_number?: string | null
          invoice_url?: string | null
          items?: Json
          order_number?: string | null
          paid_at?: string | null
          payment_status?: string
          peppol_id?: string | null
          po_number?: string | null
          project_id?: string | null
          rfq_id?: string | null
          shipped_at?: string | null
          status?: string
          total_ex_vat?: number | null
          total_inc_vat?: number | null
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
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
      product_accessories: {
        Row: {
          accessory_category: string | null
          accessory_code: string
          description: string | null
          family_id: string | null
          id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          accessory_category?: string | null
          accessory_code: string
          description?: string | null
          family_id?: string | null
          id?: string
          name: string
          sort_order?: number | null
        }
        Update: {
          accessory_category?: string | null
          accessory_code?: string
          description?: string | null
          family_id?: string | null
          id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_accessories_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "configurator_families"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "product_docs_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "products_core"
            referencedColumns: ["family_id"]
          },
        ]
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
            foreignKeyName: "product_relations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_priced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_relations_related_product_id_fkey"
            columns: ["related_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_relations_related_product_id_fkey"
            columns: ["related_product_id"]
            isOneToOne: false
            referencedRelation: "products_priced"
            referencedColumns: ["id"]
          },
        ]
      }
      product_relations_old: {
        Row: {
          from_id: string | null
          id: number
          notes: string | null
          priority: number | null
          relation_type: string | null
          to_id: string | null
        }
        Insert: {
          from_id?: string | null
          id?: number
          notes?: string | null
          priority?: number | null
          relation_type?: string | null
          to_id?: string | null
        }
        Update: {
          from_id?: string | null
          id?: number
          notes?: string | null
          priority?: number | null
          relation_type?: string | null
          to_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_relations_from_id_fkey"
            columns: ["from_id"]
            isOneToOne: false
            referencedRelation: "products_core"
            referencedColumns: ["family_id"]
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
          {
            foreignKeyName: "product_specs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_priced"
            referencedColumns: ["id"]
          },
        ]
      }
      product_specs_old: {
        Row: {
          family_id: string | null
          id: number
          notes: string | null
          spec_key: string | null
          spec_max: string | null
          spec_min: string | null
          spec_value: string | null
          unit: string | null
        }
        Insert: {
          family_id?: string | null
          id?: number
          notes?: string | null
          spec_key?: string | null
          spec_max?: string | null
          spec_min?: string | null
          spec_value?: string | null
          unit?: string | null
        }
        Update: {
          family_id?: string | null
          id?: number
          notes?: string | null
          spec_key?: string | null
          spec_max?: string | null
          spec_min?: string | null
          spec_value?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_specs_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "products_core"
            referencedColumns: ["family_id"]
          },
        ]
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
          height_mm: number | null
          id: string
          image_url: string | null
          ip_rating: string | null
          lead_time_days: number | null
          length_mm: number | null
          margin: number | null
          name: string
          purchase_price: number | null
          sku: string
          status: string | null
          updated_at: string | null
          voltage: string | null
          weight_kg: number | null
          width_mm: number | null
        }
        Insert: {
          availability?: string | null
          brand_id: string
          category_id: string
          created_at?: string | null
          description?: string | null
          family?: string | null
          fieldbus?: string | null
          height_mm?: number | null
          id?: string
          image_url?: string | null
          ip_rating?: string | null
          lead_time_days?: number | null
          length_mm?: number | null
          margin?: number | null
          name: string
          purchase_price?: number | null
          sku: string
          status?: string | null
          updated_at?: string | null
          voltage?: string | null
          weight_kg?: number | null
          width_mm?: number | null
        }
        Update: {
          availability?: string | null
          brand_id?: string
          category_id?: string
          created_at?: string | null
          description?: string | null
          family?: string | null
          fieldbus?: string | null
          height_mm?: number | null
          id?: string
          image_url?: string | null
          ip_rating?: string | null
          lead_time_days?: number | null
          length_mm?: number | null
          margin?: number | null
          name?: string
          purchase_price?: number | null
          sku?: string
          status?: string | null
          updated_at?: string | null
          voltage?: string | null
          weight_kg?: number | null
          width_mm?: number | null
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
      projects: {
        Row: {
          answers: Json
          bom_id: string | null
          bom_lines: Json
          created_at: string
          description: string | null
          id: string
          locale: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          bom_id?: string | null
          bom_lines?: Json
          created_at?: string
          description?: string | null
          id?: string
          locale?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          bom_id?: string | null
          bom_lines?: Json
          created_at?: string
          description?: string | null
          id?: string
          locale?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "boms"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      rfq_items: {
        Row: {
          id: string
          item_name: string | null
          note: string | null
          order_code: string | null
          product_id: string | null
          qty: number | null
          rfq_id: string
          role: string | null
          sort_order: number | null
          unit_price: number | null
          unit_price_currency: string | null
        }
        Insert: {
          id?: string
          item_name?: string | null
          note?: string | null
          order_code?: string | null
          product_id?: string | null
          qty?: number | null
          rfq_id: string
          role?: string | null
          sort_order?: number | null
          unit_price?: number | null
          unit_price_currency?: string | null
        }
        Update: {
          id?: string
          item_name?: string | null
          note?: string | null
          order_code?: string | null
          product_id?: string | null
          qty?: number | null
          rfq_id?: string
          role?: string | null
          sort_order?: number | null
          unit_price?: number | null
          unit_price_currency?: string | null
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
            foreignKeyName: "rfq_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_priced"
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
      rfq_status_log: {
        Row: {
          created_at: string | null
          estimated_next: string | null
          id: string
          internal_message: string | null
          message: string | null
          rfq_id: string | null
          status: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string | null
          estimated_next?: string | null
          id?: string
          internal_message?: string | null
          message?: string | null
          rfq_id?: string | null
          status: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string | null
          estimated_next?: string | null
          id?: string
          internal_message?: string | null
          message?: string | null
          rfq_id?: string | null
          status?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_status_log_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      rfqs: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_postal: string | null
          address_street: string | null
          bom_id: string | null
          carrier: string | null
          company: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          discount_pct: number
          estimated_delivery: string | null
          fortnox_order_id: string | null
          hubspot_contact_id: string | null
          hubspot_deal_id: string | null
          id: string
          integration_error: string | null
          integration_synced_at: string | null
          internal_notes: string | null
          label_url: string | null
          message: string | null
          org_number: string | null
          po_number: string | null
          quote_amount: number | null
          quote_currency: string | null
          shipment_status: string | null
          shipped_at: string | null
          status: string | null
          title: string | null
          tracking_code: string | null
          tracking_number: string | null
          updated_at: string | null
          user_id: string | null
          vat_number: string | null
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_postal?: string | null
          address_street?: string | null
          bom_id?: string | null
          carrier?: string | null
          company?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          discount_pct?: number
          estimated_delivery?: string | null
          fortnox_order_id?: string | null
          hubspot_contact_id?: string | null
          hubspot_deal_id?: string | null
          id?: string
          integration_error?: string | null
          integration_synced_at?: string | null
          internal_notes?: string | null
          label_url?: string | null
          message?: string | null
          org_number?: string | null
          po_number?: string | null
          quote_amount?: number | null
          quote_currency?: string | null
          shipment_status?: string | null
          shipped_at?: string | null
          status?: string | null
          title?: string | null
          tracking_code?: string | null
          tracking_number?: string | null
          updated_at?: string | null
          user_id?: string | null
          vat_number?: string | null
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_postal?: string | null
          address_street?: string | null
          bom_id?: string | null
          carrier?: string | null
          company?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          discount_pct?: number
          estimated_delivery?: string | null
          fortnox_order_id?: string | null
          hubspot_contact_id?: string | null
          hubspot_deal_id?: string | null
          id?: string
          integration_error?: string | null
          integration_synced_at?: string | null
          internal_notes?: string | null
          label_url?: string | null
          message?: string | null
          org_number?: string | null
          po_number?: string | null
          quote_amount?: number | null
          quote_currency?: string | null
          shipment_status?: string | null
          shipped_at?: string | null
          status?: string | null
          title?: string | null
          tracking_code?: string | null
          tracking_number?: string | null
          updated_at?: string | null
          user_id?: string | null
          vat_number?: string | null
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
      shipments: {
        Row: {
          booked_at: string | null
          carrier: string
          created_at: string | null
          error: string | null
          id: string
          label_format: string | null
          label_url: string | null
          raw_response: Json | null
          rfq_id: string | null
          service_code: string | null
          status: string | null
          tracking_number: string | null
          weight_kg: number | null
        }
        Insert: {
          booked_at?: string | null
          carrier?: string
          created_at?: string | null
          error?: string | null
          id?: string
          label_format?: string | null
          label_url?: string | null
          raw_response?: Json | null
          rfq_id?: string | null
          service_code?: string | null
          status?: string | null
          tracking_number?: string | null
          weight_kg?: number | null
        }
        Update: {
          booked_at?: string | null
          carrier?: string
          created_at?: string | null
          error?: string | null
          id?: string
          label_format?: string | null
          label_url?: string | null
          raw_response?: Json | null
          rfq_id?: string | null
          service_code?: string | null
          status?: string | null
          tracking_number?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      site_content: {
        Row: {
          id: string
          key: string
          locale: string
          updated_at: string | null
          updated_by: string | null
          value: string
        }
        Insert: {
          id?: string
          key: string
          locale: string
          updated_at?: string | null
          updated_by?: string | null
          value: string
        }
        Update: {
          id?: string
          key?: string
          locale?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      supplier_acknowledgements: {
        Row: {
          created_at: string
          id: string
          line_count: number
          note: string | null
          raw_payload: Json | null
          received_at: string
          registered_by: string | null
          source: string
          spo_id: string
          supplier_reference: string | null
          worst_level: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          line_count?: number
          note?: string | null
          raw_payload?: Json | null
          received_at?: string
          registered_by?: string | null
          source?: string
          spo_id: string
          supplier_reference?: string | null
          worst_level?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          line_count?: number
          note?: string | null
          raw_payload?: Json | null
          received_at?: string
          registered_by?: string | null
          source?: string
          spo_id?: string
          supplier_reference?: string | null
          worst_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_acknowledgements_spo_id_fkey"
            columns: ["spo_id"]
            isOneToOne: false
            referencedRelation: "supplier_purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_integrations: {
        Row: {
          ack_method: string | null
          auth_secret_name: string | null
          config: Json
          created_at: string
          delay_tolerance_days: number
          endpoint_url: string | null
          id: string
          is_primary: boolean
          last_verified_at: string | null
          method: string
          notes: string | null
          order_format: string | null
          price_tolerance_pct: number
          status: string
          supplier_id: string
          tracking_method: string | null
          updated_at: string
        }
        Insert: {
          ack_method?: string | null
          auth_secret_name?: string | null
          config?: Json
          created_at?: string
          delay_tolerance_days?: number
          endpoint_url?: string | null
          id?: string
          is_primary?: boolean
          last_verified_at?: string | null
          method: string
          notes?: string | null
          order_format?: string | null
          price_tolerance_pct?: number
          status?: string
          supplier_id: string
          tracking_method?: string | null
          updated_at?: string
        }
        Update: {
          ack_method?: string | null
          auth_secret_name?: string | null
          config?: Json
          created_at?: string
          delay_tolerance_days?: number
          endpoint_url?: string | null
          id?: string
          is_primary?: boolean
          last_verified_at?: string | null
          method?: string
          notes?: string | null
          order_format?: string | null
          price_tolerance_pct?: number
          status?: string
          supplier_id?: string
          tracking_method?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_integrations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_products: {
        Row: {
          created_at: string
          currency: string
          id: string
          is_preferred: boolean
          last_verified_at: string | null
          lead_time_days: number | null
          moq: number | null
          notes: string | null
          pack_size: number | null
          price_source: string | null
          price_valid_from: string | null
          price_valid_to: string | null
          product_id: string | null
          purchase_price: number | null
          supplier_id: string
          supplier_name: string | null
          supplier_sku: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          is_preferred?: boolean
          last_verified_at?: string | null
          lead_time_days?: number | null
          moq?: number | null
          notes?: string | null
          pack_size?: number | null
          price_source?: string | null
          price_valid_from?: string | null
          price_valid_to?: string | null
          product_id?: string | null
          purchase_price?: number | null
          supplier_id: string
          supplier_name?: string | null
          supplier_sku: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          is_preferred?: boolean
          last_verified_at?: string | null
          lead_time_days?: number | null
          moq?: number | null
          notes?: string | null
          pack_size?: number | null
          price_source?: string | null
          price_valid_from?: string | null
          price_valid_to?: string | null
          product_id?: string | null
          purchase_price?: number | null
          supplier_id?: string
          supplier_name?: string | null
          supplier_sku?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_priced"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_purchase_order_items: {
        Row: {
          ack_delivery_date: string | null
          ack_id: string | null
          ack_note: string | null
          ack_qty: number | null
          ack_reason: string | null
          ack_status: string | null
          ack_substitute_sku: string | null
          ack_unit_price: number | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          line_no: number
          line_total_ex_vat: number | null
          name: string
          order_item_id: string | null
          qty: number
          sku: string
          spo_id: string
          status: string
          supplier_sku: string | null
          unit_purchase_price: number | null
          updated_at: string
        }
        Insert: {
          ack_delivery_date?: string | null
          ack_id?: string | null
          ack_note?: string | null
          ack_qty?: number | null
          ack_reason?: string | null
          ack_status?: string | null
          ack_substitute_sku?: string | null
          ack_unit_price?: number | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          line_no: number
          line_total_ex_vat?: number | null
          name: string
          order_item_id?: string | null
          qty: number
          sku: string
          spo_id: string
          status?: string
          supplier_sku?: string | null
          unit_purchase_price?: number | null
          updated_at?: string
        }
        Update: {
          ack_delivery_date?: string | null
          ack_id?: string | null
          ack_note?: string | null
          ack_qty?: number | null
          ack_reason?: string | null
          ack_status?: string | null
          ack_substitute_sku?: string | null
          ack_unit_price?: number | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          line_no?: number
          line_total_ex_vat?: number | null
          name?: string
          order_item_id?: string | null
          qty?: number
          sku?: string
          spo_id?: string
          status?: string
          supplier_sku?: string | null
          unit_purchase_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_purchase_order_items_ack_id_fkey"
            columns: ["ack_id"]
            isOneToOne: false
            referencedRelation: "supplier_acknowledgements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_purchase_order_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_purchase_order_items_spo_id_fkey"
            columns: ["spo_id"]
            isOneToOne: false
            referencedRelation: "supplier_purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_purchase_orders: {
        Row: {
          ack_received_at: string | null
          created_at: string
          currency: string
          expected_delivery: string | null
          id: string
          idempotency_key: string | null
          integration_method: string | null
          internal_notes: string | null
          needs_review: boolean
          order_id: string
          po_number: string | null
          review_reason: string | null
          sent_at: string | null
          sent_method: string | null
          sent_to: string | null
          status: string
          supplier_id: string | null
          total_purchase_ex_vat: number | null
          updated_at: string
        }
        Insert: {
          ack_received_at?: string | null
          created_at?: string
          currency?: string
          expected_delivery?: string | null
          id?: string
          idempotency_key?: string | null
          integration_method?: string | null
          internal_notes?: string | null
          needs_review?: boolean
          order_id: string
          po_number?: string | null
          review_reason?: string | null
          sent_at?: string | null
          sent_method?: string | null
          sent_to?: string | null
          status?: string
          supplier_id?: string | null
          total_purchase_ex_vat?: number | null
          updated_at?: string
        }
        Update: {
          ack_received_at?: string | null
          created_at?: string
          currency?: string
          expected_delivery?: string | null
          id?: string
          idempotency_key?: string | null
          integration_method?: string | null
          internal_notes?: string | null
          needs_review?: boolean
          order_id?: string
          po_number?: string | null
          review_reason?: string | null
          sent_at?: string | null
          sent_method?: string | null
          sent_to?: string | null
          status?: string
          supplier_id?: string | null
          total_purchase_ex_vat?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_purchase_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          agreement_notes: string | null
          agreement_signed_at: string | null
          agreement_status: string
          allows_dropship: boolean | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string
          created_at: string
          currency: string
          customer_number: string | null
          default_lead_time_days: number | null
          discount_notes: string | null
          dropship_notes: string | null
          free_freight_over: number | null
          freight_notes: string | null
          id: string
          incoterms: string | null
          internal_notes: string | null
          is_active: boolean
          legal_name: string | null
          min_order_value: number | null
          name: string
          order_email: string | null
          order_portal_url: string | null
          org_number: string | null
          payment_terms: string | null
          price_list_ref: string | null
          product_data_rights: string | null
          returns_process: string | null
          slug: string
          stock_data_method: string | null
          system_notes: string | null
          updated_at: string
          warranty_terms: string | null
        }
        Insert: {
          agreement_notes?: string | null
          agreement_signed_at?: string | null
          agreement_status?: string
          allows_dropship?: boolean | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string
          created_at?: string
          currency?: string
          customer_number?: string | null
          default_lead_time_days?: number | null
          discount_notes?: string | null
          dropship_notes?: string | null
          free_freight_over?: number | null
          freight_notes?: string | null
          id?: string
          incoterms?: string | null
          internal_notes?: string | null
          is_active?: boolean
          legal_name?: string | null
          min_order_value?: number | null
          name: string
          order_email?: string | null
          order_portal_url?: string | null
          org_number?: string | null
          payment_terms?: string | null
          price_list_ref?: string | null
          product_data_rights?: string | null
          returns_process?: string | null
          slug: string
          stock_data_method?: string | null
          system_notes?: string | null
          updated_at?: string
          warranty_terms?: string | null
        }
        Update: {
          agreement_notes?: string | null
          agreement_signed_at?: string | null
          agreement_status?: string
          allows_dropship?: boolean | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string
          created_at?: string
          currency?: string
          customer_number?: string | null
          default_lead_time_days?: number | null
          discount_notes?: string | null
          dropship_notes?: string | null
          free_freight_over?: number | null
          freight_notes?: string | null
          id?: string
          incoterms?: string | null
          internal_notes?: string | null
          is_active?: boolean
          legal_name?: string | null
          min_order_value?: number | null
          name?: string
          order_email?: string | null
          order_portal_url?: string | null
          org_number?: string | null
          payment_terms?: string | null
          price_list_ref?: string | null
          product_data_rights?: string | null
          returns_process?: string | null
          slug?: string
          stock_data_method?: string | null
          system_notes?: string | null
          updated_at?: string
          warranty_terms?: string | null
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
      use_case_map_old: {
        Row: {
          best_recommendation: string | null
          category: string | null
          cheapest_recommendation: string | null
          id: number
          notes: string | null
          priority_order: string | null
          recommended_families: string | null
          sub_category: string | null
          use_case: string | null
        }
        Insert: {
          best_recommendation?: string | null
          category?: string | null
          cheapest_recommendation?: string | null
          id?: number
          notes?: string | null
          priority_order?: string | null
          recommended_families?: string | null
          sub_category?: string | null
          use_case?: string | null
        }
        Update: {
          best_recommendation?: string | null
          category?: string | null
          cheapest_recommendation?: string | null
          id?: number
          notes?: string | null
          priority_order?: string | null
          recommended_families?: string | null
          sub_category?: string | null
          use_case?: string | null
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
      products_priced: {
        Row: {
          availability: string | null
          brand_id: string | null
          category_id: string | null
          created_at: string | null
          description: string | null
          estimated_delivery_days: number | null
          family: string | null
          fieldbus: string | null
          height_mm: number | null
          id: string | null
          image_url: string | null
          ip_rating: string | null
          lead_time_days: number | null
          length_mm: number | null
          margin: number | null
          name: string | null
          purchase_price: number | null
          selling_price: number | null
          sku: string | null
          status: string | null
          updated_at: string | null
          voltage: string | null
          weight_kg: number | null
          width_mm: number | null
        }
        Insert: {
          availability?: string | null
          brand_id?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          estimated_delivery_days?: never
          family?: string | null
          fieldbus?: string | null
          height_mm?: number | null
          id?: string | null
          image_url?: string | null
          ip_rating?: string | null
          lead_time_days?: number | null
          length_mm?: number | null
          margin?: number | null
          name?: string | null
          purchase_price?: number | null
          selling_price?: never
          sku?: string | null
          status?: string | null
          updated_at?: string | null
          voltage?: string | null
          weight_kg?: number | null
          width_mm?: number | null
        }
        Update: {
          availability?: string | null
          brand_id?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          estimated_delivery_days?: never
          family?: string | null
          fieldbus?: string | null
          height_mm?: number | null
          id?: string | null
          image_url?: string | null
          ip_rating?: string | null
          lead_time_days?: number | null
          length_mm?: number | null
          margin?: number | null
          name?: string | null
          purchase_price?: number | null
          selling_price?: never
          sku?: string | null
          status?: string | null
          updated_at?: string | null
          voltage?: string | null
          weight_kg?: number | null
          width_mm?: number | null
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
    }
    Functions: {
      admin_list_product_pricing: {
        Args: never
        Returns: {
          brand_id: string
          brand_name: string
          category_id: string
          category_name: string
          id: string
          is_family: boolean
          margin: number
          name: string
          purchase_price: number
          sku: string
        }[]
      }
      calculate_customer_score: {
        Args: {
          profile: Database["public"]["Tables"]["company_profiles"]["Row"]
        }
        Returns: Json
      }
      check_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      create_order_internal: {
        Args: { p_items: Json; p_order: Json }
        Returns: string
      }
      create_order_with_items: {
        Args: { p_items: Json; p_order: Json }
        Returns: string
      }
      create_supplier_pos: {
        Args: { p_order_id: string }
        Returns: {
          antal_rader: number
          needs_review: boolean
          po_number: string
          spo_id: string
          supplier: string
        }[]
      }
      fetch_products_for_advisor: {
        Args: { p_category_slug?: string; p_limit?: number }
        Returns: Json
      }
      get_family_briefs: {
        Args: never
        Returns: {
          bores: number[]
          name: string
          slug: string
          stroke_max: number
          stroke_min: number
        }[]
      }
      get_family_documents: {
        Args: { p_family_slug: string }
        Returns: {
          chunks: number
          doc_title: string
          source_file: string
        }[]
      }
      get_family_facts: {
        Args: { p_slug: string }
        Returns: {
          brand: string
          name: string
          sku: string
          specs: Json
        }[]
      }
      get_order_by_id: {
        Args: { p_id: string }
        Returns: {
          created_at: string
          currency: string
          customer_company: string
          customer_email: string
          customer_name: string
          customer_org_nr: string
          estimated_delivery: string
          id: string
          items: Json
          po_number: string
          status: string
          total_ex_vat: number
          total_inc_vat: number
        }[]
      }
      get_product_relations: {
        Args: { p_sku: string }
        Returns: {
          brand: string
          category: string
          direction: string
          name: string
          quality: string
          relation_type: string
          sku: string
        }[]
      }
      get_quote_by_id: {
        Args: { p_id: string }
        Returns: {
          company: string
          contact_email: string
          contact_name: string
          created_at: string
          discount_pct: number
          id: string
          org_number: string
          po_number: string
          quote_amount: number
          quote_currency: string
          status: string
        }[]
      }
      get_quote_items: {
        Args: { p_rfq_id: string }
        Returns: {
          id: string
          name: string
          note: string
          qty: number
          sku: string
          unit_price: number
        }[]
      }
      get_rfq_status_log: {
        Args: { p_rfq_id: string }
        Returns: {
          created_at: string
          estimated_next: string
          id: string
          message: string
          status: string
          triggered_by: string
        }[]
      }
      get_similar_products: {
        Args: { p_limit?: number; p_sku: string }
        Returns: {
          bore_mm: number
          brand: string
          category: string
          match_basis: string
          name: string
          sku: string
          stroke_mm: number
        }[]
      }
      godkann_avvikelse: {
        Args: { p_beslut: string; p_spoi_id: string }
        Returns: string
      }
      has_role: { Args: { check_role: string; uid: string }; Returns: boolean }
      klassificera_avvikelse: {
        Args: {
          p_bekraftad_leverans: string
          p_bekraftat_antal: number
          p_bekraftat_pris: number
          p_bestallt_antal: number
          p_bestallt_pris: number
          p_ersattning: string
          p_forsinkningstolerans?: number
          p_onskad_leverans: string
          p_pristolerans_pct?: number
          p_svar: string
        }
        Returns: {
          niva: string
          skal: string
        }[]
      }
      next_document_number: { Args: { p_prefix: string }; Returns: string }
      next_order_number: { Args: never; Returns: string }
      refresh_order_items_json: {
        Args: { p_order_ids: string[] }
        Returns: undefined
      }
      register_supplier_ack: {
        Args: {
          p_lines: Json
          p_note?: string
          p_source?: string
          p_spo_id: string
          p_supplier_reference?: string
        }
        Returns: {
          ack_id: string
          antal_gron: number
          antal_gul: number
          antal_rod: number
          worst_level: string
        }[]
      }
      respond_to_quote: {
        Args: { p_decision: string; p_id: string; p_po?: string }
        Returns: {
          order_id: string
          success: boolean
        }[]
      }
      rfq_status_counts: {
        Args: never
        Returns: {
          n: number
          status: string
        }[]
      }
      save_my_profile: {
        Args: {
          p_address_city?: string
          p_address_country?: string
          p_address_postal?: string
          p_address_street?: string
          p_company_name?: string
          p_display_name?: string
          p_employees?: string
          p_industry?: string
          p_locale?: string
          p_org_number?: string
          p_phone?: string
          p_role?: string
        }
        Returns: {
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
        }[]
        SetofOptions: {
          from: "*"
          to: "company_profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_knowledge: {
        Args: {
          filter_brand?: string
          match_count?: number
          query_text: string
        }
        Returns: {
          brand: string
          content: string
          id: string
          product_family: string
          rank: number
          source_file: string
        }[]
      }
      submit_rfq: {
        Args: {
          p_company: string
          p_contact_email: string
          p_contact_name: string
          p_contact_phone: string
          p_hp?: string
          p_items: Json
          p_message: string
          p_org_number: string
          p_po_number: string
          p_title: string
        }
        Returns: string
      }
      sv_en_term: { Args: { w: string }; Returns: string }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
