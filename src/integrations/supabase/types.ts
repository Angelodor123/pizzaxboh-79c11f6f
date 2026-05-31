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
      ai_learning_dictionary: {
        Row: {
          ai_suggestion: Json
          branch_id: string | null
          context: string
          created_at: string
          id: string
          resolved_intent: Json
          user_id: string | null
          user_input: string
        }
        Insert: {
          ai_suggestion?: Json
          branch_id?: string | null
          context?: string
          created_at?: string
          id?: string
          resolved_intent?: Json
          user_id?: string | null
          user_input: string
        }
        Update: {
          ai_suggestion?: Json
          branch_id?: string | null
          context?: string
          created_at?: string
          id?: string
          resolved_intent?: Json
          user_id?: string | null
          user_input?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      branches: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          features: Json
          id: string
          image_url: string | null
          latitude: number | null
          longitude: number | null
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          features?: Json
          id?: string
          image_url?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          features?: Json
          id?: string
          image_url?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      calendar_event_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          deleted: boolean
          end_time: string | null
          event_id: string
          expected_items: Json | null
          high_priority: boolean | null
          id: string
          notes: string | null
          override_date: string
          start_time: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted?: boolean
          end_time?: string | null
          event_id: string
          expected_items?: Json | null
          high_priority?: boolean | null
          id?: string
          notes?: string | null
          override_date: string
          start_time?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted?: boolean
          end_time?: string | null
          event_id?: string
          expected_items?: Json | null
          high_priority?: boolean | null
          id?: string
          notes?: string | null
          override_date?: string
          start_time?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_overrides_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          branch_id: string
          category: string
          created_at: string
          created_by: string | null
          end_time: string | null
          event_date: string | null
          event_type: string | null
          expected_items: Json
          high_priority: boolean
          id: string
          is_auto: boolean
          notes: string | null
          projector_broadcast: boolean
          recurring_weekday: number | null
          start_time: string | null
          supplier: string | null
          supplier_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          category: string
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          event_date?: string | null
          event_type?: string | null
          expected_items?: Json
          high_priority?: boolean
          id?: string
          is_auto?: boolean
          notes?: string | null
          projector_broadcast?: boolean
          recurring_weekday?: number | null
          start_time?: string | null
          supplier?: string | null
          supplier_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          category?: string
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          event_date?: string | null
          event_type?: string | null
          expected_items?: Json
          high_priority?: boolean
          id?: string
          is_auto?: boolean
          notes?: string | null
          projector_broadcast?: boolean
          recurring_weekday?: number | null
          start_time?: string | null
          supplier?: string | null
          supplier_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      cibus_transactions_log: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          transaction_date: string
          type: string
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          transaction_date?: string
          type: string
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          transaction_date?: string
          type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cibus_transactions_log_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "cibus_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      cibus_wallets: {
        Row: {
          balance: number
          created_at: string
          created_by: string | null
          customer_name: string
          id: string
          last_updated: string
          phone_number: string
        }
        Insert: {
          balance?: number
          created_at?: string
          created_by?: string | null
          customer_name: string
          id?: string
          last_updated?: string
          phone_number: string
        }
        Update: {
          balance?: number
          created_at?: string
          created_by?: string | null
          customer_name?: string
          id?: string
          last_updated?: string
          phone_number?: string
        }
        Relationships: []
      }
      customer_complaints: {
        Row: {
          address: string | null
          compensation_notes: string | null
          created_at: string
          created_by: string | null
          customer_name: string
          description: string
          id: string
          manager_notes: string | null
          phone_number: string
          status: Database["public"]["Enums"]["complaint_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          compensation_notes?: string | null
          created_at?: string
          created_by?: string | null
          customer_name: string
          description: string
          id?: string
          manager_notes?: string | null
          phone_number: string
          status?: Database["public"]["Enums"]["complaint_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          compensation_notes?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string
          description?: string
          id?: string
          manager_notes?: string | null
          phone_number?: string
          status?: Database["public"]["Enums"]["complaint_status"]
          updated_at?: string
        }
        Relationships: []
      }
      daily_operational_history: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          kind: string
          payload: Json
          snapshot_date: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          snapshot_date: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          snapshot_date?: string
        }
        Relationships: []
      }
      daily_task_logs: {
        Row: {
          branch_id: string
          comments: string | null
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          completed_by_user_id: string | null
          created_at: string
          id: string
          log_date: string
          photo_url: string | null
          task_id: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          comments?: string | null
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          completed_by_user_id?: string | null
          created_at?: string
          id?: string
          log_date?: string
          photo_url?: string | null
          task_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          comments?: string | null
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          completed_by_user_id?: string | null
          created_at?: string
          id?: string
          log_date?: string
          photo_url?: string | null
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_task_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      dough_updates_log: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          location: string
          prep_item_id: string
          trays_count: number
          updated_by: string | null
          updated_by_name: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          location?: string
          prep_item_id: string
          trays_count: number
          updated_by?: string | null
          updated_by_name?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          location?: string
          prep_item_id?: string
          trays_count?: number
          updated_by?: string | null
          updated_by_name?: string | null
        }
        Relationships: []
      }
      equipment_types: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      ev_vehicles: {
        Row: {
          battery_pct: number
          branch_id: string
          created_at: string
          id: string
          issue_note: string | null
          name: string
          sort_order: number
          status: string
          swap_at: string | null
          updated_at: string
        }
        Insert: {
          battery_pct?: number
          branch_id: string
          created_at?: string
          id?: string
          issue_note?: string | null
          name: string
          sort_order?: number
          status?: string
          swap_at?: string | null
          updated_at?: string
        }
        Update: {
          battery_pct?: number
          branch_id?: string
          created_at?: string
          id?: string
          issue_note?: string | null
          name?: string
          sort_order?: number
          status?: string
          swap_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ev_vehicles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          branch_id: string
          created_at: string
          current_stock: number
          id: string
          name: string
          sort_order: number
          unit: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          current_stock?: number
          id?: string
          name: string
          sort_order?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          current_stock?: number
          id?: string
          name?: string
          sort_order?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          inventory_item_id: string
          invoice_id: string | null
          note: string | null
          order_id: string | null
          qty_delta: number
          source: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_item_id: string
          invoice_id?: string | null
          note?: string | null
          order_id?: string | null
          qty_delta: number
          source?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_item_id?: string
          invoice_id?: string | null
          note?: string | null
          order_id?: string | null
          qty_delta?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          assigned_branch_id: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          assigned_branch_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          assigned_branch_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          category: string | null
          created_at: string
          id: string
          invoice_id: string
          item_name: string
          quantity: number
          sort_order: number
          total_price: number
          unit_price: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          invoice_id: string
          item_name?: string
          quantity?: number
          sort_order?: number
          total_price?: number
          unit_price?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          invoice_id?: string
          item_name?: string
          quantity?: number
          sort_order?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_ocr_feedback: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          diff_summary: string | null
          final_data: Json
          id: string
          invoice_id: string | null
          raw_ocr: Json
          supplier_id: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          diff_summary?: string | null
          final_data?: Json
          id?: string
          invoice_id?: string | null
          raw_ocr?: Json
          supplier_id?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          diff_summary?: string | null
          final_data?: Json
          id?: string
          invoice_id?: string | null
          raw_ocr?: Json
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_ocr_feedback_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_ocr_feedback_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          document_date: string
          id: string
          image_url: string | null
          invoice_image_url: string | null
          invoice_number: string
          is_archived: boolean
          notes: string | null
          order_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          supplier_id: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          document_date?: string
          id?: string
          image_url?: string | null
          invoice_image_url?: string | null
          invoice_number?: string
          is_archived?: boolean
          notes?: string | null
          order_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          document_date?: string
          id?: string
          image_url?: string | null
          invoice_image_url?: string | null
          invoice_number?: string
          is_archived?: boolean
          notes?: string | null
          order_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_tickets: {
        Row: {
          branch_id: string | null
          created_at: string
          description: string
          equipment_type_id: string | null
          id: string
          is_read_by_admin: boolean
          photo_url: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
          urgency: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          description: string
          equipment_type_id?: string | null
          id?: string
          is_read_by_admin?: boolean
          photo_url?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          urgency: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          description?: string
          equipment_type_id?: string | null
          id?: string
          is_read_by_admin?: boolean
          photo_url?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          urgency?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tickets_equipment_type_id_fkey"
            columns: ["equipment_type_id"]
            isOneToOne: false
            referencedRelation: "equipment_types"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_units: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      notebook_items: {
        Row: {
          archived_at: string | null
          branch_id: string
          catalog_product_id: string | null
          created_at: string
          created_by: string | null
          current_stock: number | null
          done: boolean
          id: string
          is_urgent: boolean
          list_key: string
          priority: string
          sort_order: number
          text: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          branch_id: string
          catalog_product_id?: string | null
          created_at?: string
          created_by?: string | null
          current_stock?: number | null
          done?: boolean
          id?: string
          is_urgent?: boolean
          list_key: string
          priority?: string
          sort_order?: number
          text: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          branch_id?: string
          catalog_product_id?: string | null
          created_at?: string
          created_by?: string | null
          current_stock?: number | null
          done?: boolean
          id?: string
          is_urgent?: boolean
          list_key?: string
          priority?: string
          sort_order?: number
          text?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notebook_items_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_products"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_snapshots: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          items: Json
          list_key: string
          snapshot_date: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          items?: Json
          list_key: string
          snapshot_date: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          items?: Json
          list_key?: string
          snapshot_date?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string | null
          items: Json
          message: string | null
          notes: string | null
          received_at: string | null
          sent_at: string
          status: Database["public"]["Enums"]["order_status"]
          supplier_id: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string | null
          items?: Json
          message?: string | null
          notes?: string | null
          received_at?: string | null
          sent_at?: string
          status?: Database["public"]["Enums"]["order_status"]
          supplier_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string | null
          items?: Json
          message?: string | null
          notes?: string | null
          received_at?: string | null
          sent_at?: string
          status?: Database["public"]["Enums"]["order_status"]
          supplier_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      page_onboarding: {
        Row: {
          body: string
          id: string
          page_key: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: string
          id?: string
          page_key: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          id?: string
          page_key?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      prep_items: {
        Row: {
          active: boolean
          branch_id: string
          created_at: string
          id: string
          ingredient_name: string | null
          is_purchased_good: boolean
          name: string
          sort_order: number
          target_fri: number
          target_mon: number
          target_sat: number
          target_sun: number
          target_thu: number
          target_tue: number
          target_wed: number
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          branch_id: string
          created_at?: string
          id?: string
          ingredient_name?: string | null
          is_purchased_good?: boolean
          name: string
          sort_order?: number
          target_fri?: number
          target_mon?: number
          target_sat?: number
          target_sun?: number
          target_thu?: number
          target_tue?: number
          target_wed?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          branch_id?: string
          created_at?: string
          id?: string
          ingredient_name?: string | null
          is_purchased_good?: boolean
          name?: string
          sort_order?: number
          target_fri?: number
          target_mon?: number
          target_sat?: number
          target_sun?: number
          target_thu?: number
          target_tue?: number
          target_wed?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prep_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      prep_log: {
        Row: {
          completed: boolean
          current_stock: number
          id: string
          log_date: string
          prep_item_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          completed?: boolean
          current_stock?: number
          id?: string
          log_date: string
          prep_item_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          completed?: boolean
          current_stock?: number
          id?: string
          log_date?: string
          prep_item_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prep_log_prep_item_id_fkey"
            columns: ["prep_item_id"]
            isOneToOne: false
            referencedRelation: "prep_items"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          completed_tutorial_steps: string[]
          created_at: string
          date_of_birth: string | null
          full_name: string | null
          has_accepted_nda: boolean
          start_date: string | null
          tutorial_cooldown_until: string | null
          tutorial_version: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_tutorial_steps?: string[]
          created_at?: string
          date_of_birth?: string | null
          full_name?: string | null
          has_accepted_nda?: boolean
          start_date?: string | null
          tutorial_cooldown_until?: string | null
          tutorial_version?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_tutorial_steps?: string[]
          created_at?: string
          date_of_birth?: string | null
          full_name?: string | null
          has_accepted_nda?: boolean
          start_date?: string | null
          tutorial_cooldown_until?: string | null
          tutorial_version?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      recipe_versions: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          recipe_id: string
          snapshot: Json
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          recipe_id: string
          snapshot: Json
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          recipe_id?: string
          snapshot?: Json
        }
        Relationships: []
      }
      recipes: {
        Row: {
          base_yield_hebrew: string
          branch_id: string
          category: string
          created_at: string
          deleted: boolean
          essence_hebrew: string | null
          id: string
          ingredients: Json
          instructions_hebrew: string
          name_hebrew: string
          shelf_life_hebrew: string | null
          sort_order: number
          spice_bag: Json | null
          technique_notes_hebrew: string | null
          texture_target_hebrew: string | null
          timer_seconds: number | null
          updated_at: string
        }
        Insert: {
          base_yield_hebrew?: string
          branch_id: string
          category: string
          created_at?: string
          deleted?: boolean
          essence_hebrew?: string | null
          id: string
          ingredients?: Json
          instructions_hebrew?: string
          name_hebrew: string
          shelf_life_hebrew?: string | null
          sort_order?: number
          spice_bag?: Json | null
          technique_notes_hebrew?: string | null
          texture_target_hebrew?: string | null
          timer_seconds?: number | null
          updated_at?: string
        }
        Update: {
          base_yield_hebrew?: string
          branch_id?: string
          category?: string
          created_at?: string
          deleted?: boolean
          essence_hebrew?: string | null
          id?: string
          ingredients?: Json
          instructions_hebrew?: string
          name_hebrew?: string
          shelf_life_hebrew?: string | null
          sort_order?: number
          spice_bag?: Json | null
          technique_notes_hebrew?: string | null
          texture_target_hebrew?: string | null
          timer_seconds?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      restock_items: {
        Row: {
          active: boolean
          barcode: string | null
          branch_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
          target_fri: number
          target_mon: number
          target_sat: number
          target_sun: number
          target_thu: number
          target_tue: number
          target_wed: number
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          barcode?: string | null
          branch_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          target_fri?: number
          target_mon?: number
          target_sat?: number
          target_sun?: number
          target_thu?: number
          target_tue?: number
          target_wed?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          barcode?: string | null
          branch_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          target_fri?: number
          target_mon?: number
          target_sat?: number
          target_sun?: number
          target_thu?: number
          target_tue?: number
          target_wed?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restock_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      restock_log: {
        Row: {
          completed: boolean
          current_stock: number
          id: string
          log_date: string
          restock_item_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          completed?: boolean
          current_stock?: number
          id?: string
          log_date: string
          restock_item_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          completed?: boolean
          current_stock?: number
          id?: string
          log_date?: string
          restock_item_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restock_log_restock_item_id_fkey"
            columns: ["restock_item_id"]
            isOneToOne: false
            referencedRelation: "restock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          active: boolean
          branch_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          branch_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          branch_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      shortage_items: {
        Row: {
          branch_id: string
          catalog_item_id: string | null
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          quantity: number
          status: string
          unit: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          catalog_item_id?: string | null
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          quantity?: number
          status?: string
          unit?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          catalog_item_id?: string | null
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          quantity?: number
          status?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shortage_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "supplier_products"
            referencedColumns: ["id"]
          },
        ]
      }
      site_texts: {
        Row: {
          created_at: string
          group_key: string
          key: string
          label: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          created_at?: string
          group_key?: string
          key: string
          label: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Update: {
          created_at?: string
          group_key?: string
          key?: string
          label?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      supplier_orders_history: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          order_details: Json
          supplier_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          order_details?: Json
          supplier_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          order_details?: Json
          supplier_id?: string
        }
        Relationships: []
      }
      supplier_product_aliases: {
        Row: {
          alias: string
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          product_id: string
          source: string
          usage_count: number
        }
        Insert: {
          alias: string
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          product_id: string
          source?: string
          usage_count?: number
        }
        Update: {
          alias?: string
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string
          source?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_product_aliases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "supplier_products"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_products: {
        Row: {
          active: boolean
          barcode: string | null
          branch_id: string
          category: string | null
          created_at: string
          created_by: string | null
          default_qty: number
          expected_price: number | null
          id: string
          image_url: string | null
          min_stock_alert: number | null
          name: string
          notes: string | null
          price: number | null
          sku: string | null
          sort_order: number
          supplier_id: string
          unit: string
          unit_size: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          barcode?: string | null
          branch_id: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          default_qty?: number
          expected_price?: number | null
          id?: string
          image_url?: string | null
          min_stock_alert?: number | null
          name: string
          notes?: string | null
          price?: number | null
          sku?: string | null
          sort_order?: number
          supplier_id: string
          unit?: string
          unit_size?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          barcode?: string | null
          branch_id?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          default_qty?: number
          expected_price?: number | null
          id?: string
          image_url?: string | null
          min_stock_alert?: number | null
          name?: string
          notes?: string | null
          price?: number | null
          sku?: string | null
          sort_order?: number
          supplier_id?: string
          unit?: string
          unit_size?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          active: boolean
          branch_id: string
          category: string
          contact: string | null
          created_at: string
          created_by: string | null
          default_end_time: string | null
          default_start_time: string | null
          delivery_days: number[]
          delivery_weekdays: number[]
          id: string
          is_archived: boolean
          last_raw_ocr: Json | null
          logo_url: string | null
          name: string
          notes: string | null
          order_cutoff_time: string | null
          order_days: number[]
          parsing_instructions: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          branch_id: string
          category?: string
          contact?: string | null
          created_at?: string
          created_by?: string | null
          default_end_time?: string | null
          default_start_time?: string | null
          delivery_days?: number[]
          delivery_weekdays?: number[]
          id?: string
          is_archived?: boolean
          last_raw_ocr?: Json | null
          logo_url?: string | null
          name: string
          notes?: string | null
          order_cutoff_time?: string | null
          order_days?: number[]
          parsing_instructions?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          branch_id?: string
          category?: string
          contact?: string | null
          created_at?: string
          created_by?: string | null
          default_end_time?: string | null
          default_start_time?: string | null
          delivery_days?: number[]
          delivery_weekdays?: number[]
          id?: string
          is_archived?: boolean
          last_raw_ocr?: Json | null
          logo_url?: string | null
          name?: string
          notes?: string | null
          order_cutoff_time?: string | null
          order_days?: number[]
          parsing_instructions?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      task_groups: {
        Row: {
          active: boolean
          branch_id: string
          created_at: string
          id: string
          name: string
          shift_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          branch_id: string
          created_at?: string
          id?: string
          name: string
          shift_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          branch_id?: string
          created_at?: string
          id?: string
          name?: string
          shift_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_groups_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          active: boolean
          branch_id: string
          created_at: string
          group_id: string | null
          id: string
          ingredient_name: string | null
          is_purchased_good: boolean
          is_urgent: boolean
          manual_order_index: number
          name: string
          parent_task_id: string | null
          prep_item_id: string | null
          recipe_id: string | null
          recurrence_day: number | null
          recurrence_type: Database["public"]["Enums"]["task_recurrence_type"]
          requires_photo: boolean
          shift_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          branch_id: string
          created_at?: string
          group_id?: string | null
          id?: string
          ingredient_name?: string | null
          is_purchased_good?: boolean
          is_urgent?: boolean
          manual_order_index?: number
          name: string
          parent_task_id?: string | null
          prep_item_id?: string | null
          recipe_id?: string | null
          recurrence_day?: number | null
          recurrence_type?: Database["public"]["Enums"]["task_recurrence_type"]
          requires_photo?: boolean
          shift_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          branch_id?: string
          created_at?: string
          group_id?: string | null
          id?: string
          ingredient_name?: string | null
          is_purchased_good?: boolean
          is_urgent?: boolean
          manual_order_index?: number
          name?: string
          parent_task_id?: string | null
          prep_item_id?: string | null
          recipe_id?: string | null
          recurrence_day?: number | null
          recurrence_type?: Database["public"]["Enums"]["task_recurrence_type"]
          requires_photo?: boolean
          shift_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "task_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_prep_item_id_fkey"
            columns: ["prep_item_id"]
            isOneToOne: false
            referencedRelation: "prep_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_branch_id: string | null
          created_at: string
          email: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_branch_id?: string | null
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_branch_id?: string | null
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_assigned_branch_id_fkey"
            columns: ["assigned_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_branch_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      daily_task_logs_reset: { Args: never; Returns: undefined }
      find_catalog_match: {
        Args: { _branch_id: string; _query: string; _supplier_id: string }
        Returns: {
          match_type: string
          product_id: string
          product_name: string
          similarity: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      list_super_admin_user_ids: { Args: never; Returns: string[] }
      list_user_directory: {
        Args: never
        Returns: {
          assigned_branch_id: string
          created_at: string
          email: string
          full_name: string
          is_active: boolean
          kind: string
          role: Database["public"]["Enums"]["app_role"]
          row_id: string
          status: string
          user_id: string
        }[]
      }
      list_user_profiles: {
        Args: never
        Returns: {
          full_name: string
          user_id: string
        }[]
      }
      network_dough_summary: {
        Args: never
        Returns: {
          branch_id: string
          branch_name: string
          total_trays: number
        }[]
      }
      notebook_daily_reset: { Args: never; Returns: undefined }
      operational_day_start: { Args: never; Returns: string }
      operational_today: { Args: never; Returns: string }
      rollover_daily_operations: { Args: never; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      task_active_on: {
        Args: { _date: string; _task_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "viewer"
        | "super_admin"
        | "manager"
        | "employee"
        | "shift_manager"
      complaint_status: "new" | "in_progress" | "resolved"
      invoice_status: "pending_review" | "approved"
      order_status: "draft" | "sent" | "received" | "cancelled"
      task_recurrence_type: "daily" | "weekly" | "monthly" | "as_needed"
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
      app_role: [
        "admin",
        "viewer",
        "super_admin",
        "manager",
        "employee",
        "shift_manager",
      ],
      complaint_status: ["new", "in_progress", "resolved"],
      invoice_status: ["pending_review", "approved"],
      order_status: ["draft", "sent", "received", "cancelled"],
      task_recurrence_type: ["daily", "weekly", "monthly", "as_needed"],
    },
  },
} as const
