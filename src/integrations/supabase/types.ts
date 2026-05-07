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
      inventario: {
        Row: {
          bitola: string
          created_at: string
          custo_total: number
          custo_unitario: number
          descricao: string
          erp: string
          id: string
          material_id: string | null
          projeto_id: string
          quantidade: number
          solicitacao_id: string
          unidade: string
        }
        Insert: {
          bitola: string
          created_at?: string
          custo_total?: number
          custo_unitario?: number
          descricao: string
          erp?: string
          id?: string
          material_id?: string | null
          projeto_id: string
          quantidade?: number
          solicitacao_id: string
          unidade?: string
        }
        Update: {
          bitola?: string
          created_at?: string
          custo_total?: number
          custo_unitario?: number
          descricao?: string
          erp?: string
          id?: string
          material_id?: string | null
          projeto_id?: string
          quantidade?: number
          solicitacao_id?: string
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventario_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventario_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventario_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      material_categorias: {
        Row: {
          created_at: string
          nome: string
        }
        Insert: {
          created_at?: string
          nome: string
        }
        Update: {
          created_at?: string
          nome?: string
        }
        Relationships: []
      }
      materials: {
        Row: {
          bitola: string
          categoria: string | null
          created_at: string
          custo: number
          descricao: string
          erp: string
          id: string
          notas: string
          sch: string
          unidade: string
        }
        Insert: {
          bitola: string
          categoria?: string | null
          created_at?: string
          custo?: number
          descricao: string
          erp?: string
          id?: string
          notas?: string
          sch?: string
          unidade?: string
        }
        Update: {
          bitola?: string
          categoria?: string | null
          created_at?: string
          custo?: number
          descricao?: string
          erp?: string
          id?: string
          notas?: string
          sch?: string
          unidade?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          nome?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          data_criacao: string
          descricao: string
          id: string
          numero: string
        }
        Insert: {
          created_at?: string
          data_criacao?: string
          descricao: string
          id?: string
          numero: string
        }
        Update: {
          created_at?: string
          data_criacao?: string
          descricao?: string
          id?: string
          numero?: string
        }
        Relationships: []
      }
      solicitacao_audit: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          after: Json | null
          at: string
          before: Json | null
          changed_fields: string[] | null
          id: number
          solicitacao_id: string | null
          solicitacao_numero: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          changed_fields?: string[] | null
          id?: number
          solicitacao_id?: string | null
          solicitacao_numero?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          changed_fields?: string[] | null
          id?: number
          solicitacao_id?: string | null
          solicitacao_numero?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitacao_audit_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacao_comments: {
        Row: {
          author_email: string
          author_id: string | null
          body: string
          created_at: string
          id: string
          solicitacao_id: string
        }
        Insert: {
          author_email: string
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          solicitacao_id: string
        }
        Update: {
          author_email?: string
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          solicitacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacao_comments_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacao_drawings: {
        Row: {
          id: string
          notas: string | null
          revisao: string
          solicitacao_id: string
          storage_path: string | null
          uploaded_at: string
          uploaded_by: string | null
          uploaded_by_email: string | null
          url: string
        }
        Insert: {
          id?: string
          notas?: string | null
          revisao?: string
          solicitacao_id: string
          storage_path?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
          uploaded_by_email?: string | null
          url: string
        }
        Update: {
          id?: string
          notas?: string | null
          revisao?: string
          solicitacao_id?: string
          storage_path?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
          uploaded_by_email?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacao_drawings_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacao_itens: {
        Row: {
          bitola: string
          custo_total: number
          custo_unitario: number
          descricao: string
          erp: string
          id: string
          material_id: string | null
          notas: string
          quantidade: number
          solicitacao_id: string
          tag: string
          unidade: string
        }
        Insert: {
          bitola: string
          custo_total?: number
          custo_unitario?: number
          descricao: string
          erp?: string
          id?: string
          material_id?: string | null
          notas?: string
          quantidade?: number
          solicitacao_id: string
          tag?: string
          unidade?: string
        }
        Update: {
          bitola?: string
          custo_total?: number
          custo_unitario?: number
          descricao?: string
          erp?: string
          id?: string
          material_id?: string | null
          notas?: string
          quantidade?: number
          solicitacao_id?: string
          tag?: string
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacao_itens_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacao_itens_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacao_saved_views: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      solicitacoes: {
        Row: {
          created_at: string
          data_solicitacao: string
          desenho: string | null
          erp: string
          id: string
          motivo: string
          notas: string
          numero: string
          projeto_id: string
          revisao: string
          status: string
        }
        Insert: {
          created_at?: string
          data_solicitacao?: string
          desenho?: string | null
          erp?: string
          id?: string
          motivo: string
          notas?: string
          numero: string
          projeto_id: string
          revisao?: string
          status?: string
        }
        Update: {
          created_at?: string
          data_solicitacao?: string
          desenho?: string | null
          erp?: string
          id?: string
          motivo?: string
          notas?: string
          numero?: string
          projeto_id?: string
          revisao?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_solicitacoes_kpis: {
        Args: {
          p_from?: string
          p_project_ids?: string[]
          p_projeto?: string
          p_search?: string
          p_status?: string[]
          p_to?: string
        }
        Returns: {
          itens_pendentes: number
          ticket_medio: number
          total_abertas: number
          total_solicitacoes: number
          valor_abertas: number
          valor_total: number
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "gerente"
        | "projetista"
        | "comprador"
        | "coordenador_campo"
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
        "gerente",
        "projetista",
        "comprador",
        "coordenador_campo",
      ],
    },
  },
} as const
