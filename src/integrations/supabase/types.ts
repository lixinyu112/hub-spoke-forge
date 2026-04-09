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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      blog_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_groups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          json_data: Json | null
          original_filename: string | null
          project_id: string
          slug: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          json_data?: Json | null
          original_filename?: string | null
          project_id: string
          slug?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          json_data?: Json | null
          original_filename?: string | null
          project_id?: string
          slug?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "blog_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_posts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      component_specs: {
        Row: {
          created_at: string
          id: string
          json_schema: Json | null
          name: string
          project_id: string
          theme_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          json_schema?: Json | null
          name: string
          project_id: string
          theme_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          json_schema?: Json | null
          name?: string
          project_id?: string
          theme_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "component_specs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "component_specs_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          content: string | null
          created_at: string
          id: string
          name: string
          project_id: string
          token: string
          type: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          name: string
          project_id: string
          token: string
          type?: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          token?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      hubs: {
        Row: {
          created_at: string
          id: string
          json_data: Json | null
          slug: string | null
          status: string
          theme_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          json_data?: Json | null
          slug?: string | null
          status?: string
          theme_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          json_data?: Json | null
          slug?: string | null
          status?: string
          theme_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hubs_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      json_records: {
        Row: {
          created_at: string
          feishu_content: string | null
          generated_json: Json | null
          id: string
          prompt_content: string | null
          type: string
        }
        Insert: {
          created_at?: string
          feishu_content?: string | null
          generated_json?: Json | null
          id?: string
          prompt_content?: string | null
          type: string
        }
        Update: {
          created_at?: string
          feishu_content?: string | null
          generated_json?: Json | null
          id?: string
          prompt_content?: string | null
          type?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      prompt_configs: {
        Row: {
          created_at: string
          id: string
          page_type: string
          project_id: string
          prompt_content: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          page_type: string
          project_id: string
          prompt_content?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          page_type?: string
          project_id?: string
          prompt_content?: string
          updated_at?: string
        }
        Relationships: []
      }
      publications: {
        Row: {
          created_at: string
          id: string
          json_data: Json | null
          language: string
          project_id: string
          published_at: string
          source_id: string
          source_type: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          json_data?: Json | null
          language?: string
          project_id: string
          published_at?: string
          source_id: string
          source_type: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          json_data?: Json | null
          language?: string
          project_id?: string
          published_at?: string
          source_id?: string
          source_type?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      spokes: {
        Row: {
          created_at: string
          feishu_doc_title: string | null
          feishu_doc_token: string | null
          hub_id: string | null
          id: string
          json_data: Json | null
          slug: string | null
          status: string
          theme_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          feishu_doc_title?: string | null
          feishu_doc_token?: string | null
          hub_id?: string | null
          id?: string
          json_data?: Json | null
          slug?: string | null
          status?: string
          theme_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          feishu_doc_title?: string | null
          feishu_doc_token?: string | null
          hub_id?: string | null
          id?: string
          json_data?: Json | null
          slug?: string | null
          status?: string
          theme_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spokes_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spokes_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      themes: {
        Row: {
          created_at: string
          description: string | null
          feishu_doc_token: string | null
          id: string
          name: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          feishu_doc_token?: string | null
          id?: string
          name: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          feishu_doc_token?: string | null
          id?: string
          name?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "themes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
