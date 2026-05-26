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
          slug?: string
          standard?: string | null
          stroke_max_mm?: number | null
          stroke_min_mm?: number | null
          title?: string
        }
        Relationships: []
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
          param_key: string
          param_type: string
          required: boolean | null
          sort_order: number | null
        }
        Insert: {
          family_id?: string | null
          id?: string
          label: string
          param_key: string
          param_type: string
          required?: boolean | null
          sort_order?: number | null
        }
        Update: {
          family_id?: string | null
          id?: string
          label?: string
          param_key?: string
          param_type?: string
          required?: boolean | null
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
          internal_notes: string | null
          invoice_date: string | null
          invoice_due_date: string | null
          invoice_number: string | null
          invoice_url: string | null
          items: Json
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
          internal_notes?: string | null
          invoice_date?: string | null
          invoice_due_date?: string | null
          invoice_number?: string | null
          invoice_url?: string | null
          items?: Json
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
          internal_notes?: string | null
          invoice_date?: string | null
          invoice_due_date?: string | null
          invoice_number?: string | null
          invoice_url?: string | null
          items?: Json
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
      rfq_items: {
        Row: {
          id: string
          note: string | null
          product_id: string | null
          qty: number | null
          rfq_id: string
          role: string | null
          unit_price: number | null
          unit_price_currency: string | null
        }
        Insert: {
          id?: string
          note?: string | null
          product_id?: string | null
          qty?: number | null
          rfq_id: string
          role?: string | null
          unit_price?: number | null
          unit_price_currency?: string | null
        }
        Update: {
          id?: string
          note?: string | null
          product_id?: string | null
          qty?: number | null
          rfq_id?: string
          role?: string | null
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
      calculate_customer_score: {
        Args: {
          profile: Database["public"]["Tables"]["company_profiles"]["Row"]
        }
        Returns: Json
      }
      fetch_products_for_advisor: {
        Args: { p_category_slug?: string; p_limit?: number }
        Returns: Json
      }
      has_role: { Args: { check_role: string; uid: string }; Returns: boolean }
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

