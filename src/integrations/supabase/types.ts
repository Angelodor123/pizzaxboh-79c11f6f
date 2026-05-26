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
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
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
          high_priority: boolean
          id: string
          is_auto: boolean
          notes: string | null
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
          high_priority?: boolean
          id?: string
          is_auto?: boolean
          notes?: string | null
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
          high_priority?: boolean
          id?: string
          is_auto?: boolean
          notes?: string | null
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
          prep_item_id: string
          trays_count: number
          updated_by: string | null
          updated_by_name: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          prep_item_id: string
          trays_count: number
          updated_by?: string | null
          updated_by_name?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
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
          created_at: string
          created_by: string | null
          done: boolean
          id: string
          is_urgent: boolean
          list_key: string
          priority: string
          sort_order: number
          text: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          branch_id: string
          created_at?: string
          created_by?: string | null
          done?: boolean
          id?: string
          is_urgent?: boolean
          list_key: string
          priority?: string
          sort_order?: number
          text: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          branch_id?: string
          created_at?: string
          created_by?: string | null
          done?: boolean
          id?: string
          is_urgent?: boolean
          list_key?: string
          priority?: string
          sort_order?: number
          text?: string
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
        ]
      }
      notebook_snapshots: {
        Row: {
          created_at: string
          id: string
          items: Json
          list_key: string
          snapshot_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          list_key: string
          snapshot_date: string
        }
        Update: {
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
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          quantity: number
          unit: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          quantity?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          quantity?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
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
          delivery_weekdays: number[]
          id: string
          is_archived: boolean
          logo_url: string | null
          name: string
          notes: string | null
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
          delivery_weekdays?: number[]
          id?: string
          is_archived?: boolean
          logo_url?: string | null
          name: string
          notes?: string | null
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
          delivery_weekdays?: number[]
          id?: string
          is_archived?: boolean
          logo_url?: string | null
          name?: string
          notes?: string | null
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
          group_id: string
          id: string
          name: string
          prep_item_id: string | null
          recipe_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          branch_id: string
          created_at?: string
          group_id: string
          id?: string
          name: string
          prep_item_id?: string | null
          recipe_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          branch_id?: string
          created_at?: string
          group_id?: string
          id?: string
          name?: string
          prep_item_id?: string | null
          recipe_id?: string | null
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
            foreignKeyName: "tasks_prep_item_id_fkey"
            columns: ["prep_item_id"]
            isOneToOne: false
            referencedRelation: "prep_items"
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
      notebook_daily_reset: { Args: never; Returns: undefined }
      operational_today: { Args: never; Returns: string }
      rollover_daily_operations: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "viewer" | "super_admin" | "manager" | "employee"
      invoice_status: "pending_review" | "approved"
      order_status: "draft" | "sent" | "received" | "cancelled"
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
      app_role: ["admin", "viewer", "super_admin", "manager", "employee"],
      invoice_status: ["pending_review", "approved"],
      order_status: ["draft", "sent", "received", "cancelled"],
    },
  },
} as const
