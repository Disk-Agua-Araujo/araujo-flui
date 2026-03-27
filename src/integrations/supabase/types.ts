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
      addresses: {
        Row: {
          city: string
          complement: string | null
          created_at: string
          customer_id: string | null
          id: string
          is_primary: boolean | null
          lat: number | null
          lng: number | null
          neighborhood: string
          number: string
          reference: string | null
          state: string
          street: string
          zip: string | null
        }
        Insert: {
          city?: string
          complement?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          is_primary?: boolean | null
          lat?: number | null
          lng?: number | null
          neighborhood: string
          number: string
          reference?: string | null
          state?: string
          street: string
          zip?: string | null
        }
        Update: {
          city?: string
          complement?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          is_primary?: boolean | null
          lat?: number | null
          lng?: number | null
          neighborhood?: string
          number?: string
          reference?: string | null
          state?: string
          street?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          auth_user_id: string | null
          created_at: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          username: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          username: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          cnpj: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          type: Database["public"]["Enums"]["customer_type"]
          updated_at: string | null
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          type?: Database["public"]["Enums"]["customer_type"]
          updated_at?: string | null
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          type?: Database["public"]["Enums"]["customer_type"]
          updated_at?: string | null
        }
        Relationships: []
      }
      delivery_riders: {
        Row: {
          active: boolean
          created_at: string
          id: string
          label: string
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          label: string
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          label?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      geocode_rate_limits: {
        Row: {
          client_ip: string
          id: string
          request_count: number
          window_start: string
        }
        Insert: {
          client_ip: string
          id?: string
          request_count?: number
          window_start?: string
        }
        Update: {
          client_ip?: string
          id?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          attempt_key: string
          created_at: string
          failed_count: number
          id: string
          last_attempt_at: string
          locked_until: string | null
        }
        Insert: {
          attempt_key: string
          created_at?: string
          failed_count?: number
          id?: string
          last_attempt_at?: string
          locked_until?: string | null
        }
        Update: {
          attempt_key?: string
          created_at?: string
          failed_count?: number
          id?: string
          last_attempt_at?: string
          locked_until?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          qty: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          qty?: number
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string
          qty?: number
        }
        Relationships: [
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
        ]
      }
      orders: {
        Row: {
          address_id: string | null
          change_for: number | null
          channel: Database["public"]["Enums"]["order_channel"]
          created_at: string
          created_by: string | null
          customer_id: string | null
          delivery_date: string | null
          delivery_time: string | null
          fulfillment_type: string
          id: string
          notes: string | null
          payment_method: string | null
          pix_paid: boolean | null
          pix_paid_at: string | null
          reminder_dismissed: boolean
          reminder_enabled: boolean
          rider_id: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          status: Database["public"]["Enums"]["order_status"]
          total_amount: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          address_id?: string | null
          change_for?: number | null
          channel?: Database["public"]["Enums"]["order_channel"]
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivery_date?: string | null
          delivery_time?: string | null
          fulfillment_type?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          pix_paid?: boolean | null
          pix_paid_at?: string | null
          reminder_dismissed?: boolean
          reminder_enabled?: boolean
          rider_id?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_amount?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          address_id?: string | null
          change_for?: number | null
          channel?: Database["public"]["Enums"]["order_channel"]
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivery_date?: string | null
          delivery_time?: string | null
          fulfillment_type?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          pix_paid?: boolean | null
          pix_paid_at?: string | null
          reminder_dismissed?: boolean
          reminder_enabled?: boolean
          rider_id?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_amount?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "delivery_riders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          category_id: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          image_url: string | null
          min_stock_qty: number
          name: string
          price_text: string | null
          show_in_quick_order: boolean
          stock_qty: number
          track_stock: boolean
          type: Database["public"]["Enums"]["product_type"]
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          min_stock_qty?: number
          name: string
          price_text?: string | null
          show_in_quick_order?: boolean
          stock_qty?: number
          track_stock?: boolean
          type?: Database["public"]["Enums"]["product_type"]
        }
        Update: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          min_stock_qty?: number
          name?: string
          price_text?: string | null
          show_in_quick_order?: boolean
          stock_qty?: number
          track_stock?: boolean
          type?: Database["public"]["Enums"]["product_type"]
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          order_id: string | null
          product_id: string
          qty: number
          reason: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          order_id?: string | null
          product_id: string
          qty: number
          reason?: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          order_id?: string | null
          product_id?: string
          qty?: number
          reason?: string | null
          type?: Database["public"]["Enums"]["stock_movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wholesale_price_tiers: {
        Row: {
          id: string
          min_qty: number
          price_text: string
          product_id: string
        }
        Insert: {
          id?: string
          min_qty: number
          price_text?: string
          product_id: string
        }
        Update: {
          id?: string
          min_qty?: number
          price_text?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_price_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_stock: {
        Args: {
          p_created_by?: string
          p_product_id: string
          p_qty: number
          p_reason?: string
          p_type: Database["public"]["Enums"]["stock_movement_type"]
        }
        Returns: number
      }
      cleanup_old_geocode_rate_limits: { Args: never; Returns: undefined }
      cleanup_old_login_attempts: { Args: never; Returns: undefined }
      create_full_site_order:
        | {
            Args: {
              p_city?: string
              p_complement?: string
              p_customer_cnpj?: string
              p_customer_name: string
              p_customer_phone: string
              p_customer_type?: Database["public"]["Enums"]["customer_type"]
              p_delivery_date?: string
              p_delivery_time?: string
              p_items?: Json
              p_neighborhood?: string
              p_notes?: string
              p_number?: string
              p_state?: string
              p_street?: string
              p_zip?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_city?: string
              p_complement?: string
              p_customer_cnpj?: string
              p_customer_name: string
              p_customer_phone: string
              p_customer_type?: Database["public"]["Enums"]["customer_type"]
              p_delivery_date?: string
              p_delivery_time?: string
              p_fulfillment_type?: string
              p_items?: Json
              p_neighborhood?: string
              p_notes?: string
              p_number?: string
              p_state?: string
              p_street?: string
              p_zip?: string
            }
            Returns: Json
          }
      deduct_stock_for_order: {
        Args: { p_created_by?: string; p_order_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_owner: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin_owner" | "admin_manager"
      customer_type: "PF" | "PJ"
      order_channel: "site" | "whatsapp" | "ligacao" | "admin"
      order_status: "novo" | "agendado" | "em_rota" | "entregue" | "cancelado"
      product_type: "varejo" | "atacado" | "ambos"
      stock_movement_type: "in" | "out" | "adjust"
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
      app_role: ["admin_owner", "admin_manager"],
      customer_type: ["PF", "PJ"],
      order_channel: ["site", "whatsapp", "ligacao", "admin"],
      order_status: ["novo", "agendado", "em_rota", "entregue", "cancelado"],
      product_type: ["varejo", "atacado", "ambos"],
      stock_movement_type: ["in", "out", "adjust"],
    },
  },
} as const
