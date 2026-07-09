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
      _migration_state: {
        Row: {
          applied_at: string
          key: string
        }
        Insert: {
          applied_at?: string
          key: string
        }
        Update: {
          applied_at?: string
          key?: string
        }
        Relationships: []
      }
      bom_audit: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          after: Json | null
          at: string
          before: Json | null
          changed_fields: string[] | null
          entity: string
          id: number
          node_id: string | null
          root_id: string | null
          version_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          changed_fields?: string[] | null
          entity: string
          id?: number
          node_id?: string | null
          root_id?: string | null
          version_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          changed_fields?: string[] | null
          entity?: string
          id?: number
          node_id?: string | null
          root_id?: string | null
          version_id?: string | null
        }
        Relationships: []
      }
      bom_comments: {
        Row: {
          author_email: string
          author_id: string | null
          body: string
          created_at: string
          id: string
          version_id: string
        }
        Insert: {
          author_email: string
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          version_id: string
        }
        Update: {
          author_email?: string
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_comments_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "bom_version"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_drawings: {
        Row: {
          id: string
          notes: string | null
          revision: string
          uploaded_at: string
          uploaded_by: string | null
          url: string
          version_id: string
        }
        Insert: {
          id?: string
          notes?: string | null
          revision: string
          uploaded_at?: string
          uploaded_by?: string | null
          url: string
          version_id: string
        }
        Update: {
          id?: string
          notes?: string | null
          revision?: string
          uploaded_at?: string
          uploaded_by?: string | null
          url?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_drawings_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "bom_version"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_node: {
        Row: {
          cloned_from_node_id: string | null
          created_at: string
          fornecedor_id: string | null
          id: string
          material_id: string | null
          name: string | null
          node_type: Database["public"]["Enums"]["bom_node_type"]
          notes: string | null
          parent_id: string | null
          position: number
          quantity: number | null
          updated_at: string
          version_id: string
        }
        Insert: {
          cloned_from_node_id?: string | null
          created_at?: string
          fornecedor_id?: string | null
          id?: string
          material_id?: string | null
          name?: string | null
          node_type: Database["public"]["Enums"]["bom_node_type"]
          notes?: string | null
          parent_id?: string | null
          position?: number
          quantity?: number | null
          updated_at?: string
          version_id: string
        }
        Update: {
          cloned_from_node_id?: string | null
          created_at?: string
          fornecedor_id?: string | null
          id?: string
          material_id?: string | null
          name?: string | null
          node_type?: Database["public"]["Enums"]["bom_node_type"]
          notes?: string | null
          parent_id?: string | null
          position?: number
          quantity?: number | null
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_node_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_node_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_node_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "bom_node"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_node_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "bom_version"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_root: {
        Row: {
          cloned_from_root_id: string | null
          codigo: string
          created_at: string
          created_by: string | null
          id: string
          is_standard: boolean
          name: string
          parent_id: string | null
          project_id: string
          quantity_in_parent: number
          updated_at: string
        }
        Insert: {
          cloned_from_root_id?: string | null
          codigo: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_standard?: boolean
          name: string
          parent_id?: string | null
          project_id: string
          quantity_in_parent?: number
          updated_at?: string
        }
        Update: {
          cloned_from_root_id?: string | null
          codigo?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_standard?: boolean
          name?: string
          parent_id?: string | null
          project_id?: string
          quantity_in_parent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_root_cloned_from_root_id_fkey"
            columns: ["cloned_from_root_id"]
            isOneToOne: false
            referencedRelation: "bom_root"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_root_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "bom_root"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_root_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_root_usage: {
        Row: {
          child_root_id: string
          created_at: string
          id: string
          notes: string | null
          parent_root_id: string
          position: number
          quantity: number
        }
        Insert: {
          child_root_id: string
          created_at?: string
          id?: string
          notes?: string | null
          parent_root_id: string
          position?: number
          quantity?: number
        }
        Update: {
          child_root_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          parent_root_id?: string
          position?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "bom_root_usage_child_root_id_fkey"
            columns: ["child_root_id"]
            isOneToOne: false
            referencedRelation: "bom_root"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_root_usage_parent_root_id_fkey"
            columns: ["parent_root_id"]
            isOneToOne: false
            referencedRelation: "bom_root"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_version: {
        Row: {
          cloned_from_version_id: string | null
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          notes: string | null
          obsoleted_at: string | null
          released_at: string | null
          root_id: string
          status: Database["public"]["Enums"]["bom_version_status"]
          version_number: number
        }
        Insert: {
          cloned_from_version_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          notes?: string | null
          obsoleted_at?: string | null
          released_at?: string | null
          root_id: string
          status?: Database["public"]["Enums"]["bom_version_status"]
          version_number: number
        }
        Update: {
          cloned_from_version_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          notes?: string | null
          obsoleted_at?: string | null
          released_at?: string | null
          root_id?: string
          status?: Database["public"]["Enums"]["bom_version_status"]
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "bom_version_cloned_from_version_id_fkey"
            columns: ["cloned_from_version_id"]
            isOneToOne: false
            referencedRelation: "bom_version"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_version_root_id_fkey"
            columns: ["root_id"]
            isOneToOne: false
            referencedRelation: "bom_root"
            referencedColumns: ["id"]
          },
        ]
      }
      calculos: {
        Row: {
          autor_id: string | null
          created_at: string
          formula: string
          id: string
          premissas: string
          projeto_id: string
          referencias: string
          resultado_unidade: string
          resultado_valor: number | null
          revisao: string
          status: string
          template_id: string
          tipo: string
          titulo: string
          updated_at: string
          valores: Json
        }
        Insert: {
          autor_id?: string | null
          created_at?: string
          formula?: string
          id?: string
          premissas?: string
          projeto_id: string
          referencias?: string
          resultado_unidade?: string
          resultado_valor?: number | null
          revisao?: string
          status?: string
          template_id: string
          tipo?: string
          titulo: string
          updated_at?: string
          valores?: Json
        }
        Update: {
          autor_id?: string | null
          created_at?: string
          formula?: string
          id?: string
          premissas?: string
          projeto_id?: string
          referencias?: string
          resultado_unidade?: string
          resultado_valor?: number | null
          revisao?: string
          status?: string
          template_id?: string
          tipo?: string
          titulo?: string
          updated_at?: string
          valores?: Json
        }
        Relationships: [
          {
            foreignKeyName: "calculos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedor_precos: {
        Row: {
          codigo_fornecedor: string
          cofins_pct: number
          created_at: string
          created_by: string | null
          data_cotacao: string
          desconto_pct: number
          fornecedor_id: string
          icms_pct: number
          id: string
          ipi_pct: number
          lead_time_dias: number
          material_id: string
          moeda: string
          moq: number
          notas: string
          pis_pct: number
          valor_unitario: number
        }
        Insert: {
          codigo_fornecedor?: string
          cofins_pct?: number
          created_at?: string
          created_by?: string | null
          data_cotacao?: string
          desconto_pct?: number
          fornecedor_id: string
          icms_pct?: number
          id?: string
          ipi_pct?: number
          lead_time_dias?: number
          material_id: string
          moeda?: string
          moq?: number
          notas?: string
          pis_pct?: number
          valor_unitario: number
        }
        Update: {
          codigo_fornecedor?: string
          cofins_pct?: number
          created_at?: string
          created_by?: string | null
          data_cotacao?: string
          desconto_pct?: number
          fornecedor_id?: string
          icms_pct?: number
          id?: string
          ipi_pct?: number
          lead_time_dias?: number
          material_id?: string
          moeda?: string
          moq?: number
          notas?: string
          pis_pct?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "fornecedor_precos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fornecedor_precos_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          nome: string
          observacoes: string
          regime_tributario: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
          observacoes?: string
          regime_tributario?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
          observacoes?: string
          regime_tributario?: string
        }
        Relationships: []
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
          fornecedor_id: string | null
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
          fornecedor_id?: string | null
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
          fornecedor_id?: string | null
          id?: string
          notas?: string
          sch?: string
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_itens: {
        Row: {
          created_at: string
          icms_pct: number
          id: string
          ipi_pct: number
          material_id: string | null
          notas: string | null
          orcamento_id: string
          pis_cofins_pct: number
          position: number
          preco_unit_com_impostos: number
          preco_unit_liquido: number | null
          quantidade: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          icms_pct?: number
          id?: string
          ipi_pct?: number
          material_id?: string | null
          notas?: string | null
          orcamento_id: string
          pis_cofins_pct?: number
          position?: number
          preco_unit_com_impostos?: number
          preco_unit_liquido?: number | null
          quantidade?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          icms_pct?: number
          id?: string
          ipi_pct?: number
          material_id?: string | null
          notas?: string | null
          orcamento_id?: string
          pis_cofins_pct?: number
          position?: number
          preco_unit_com_impostos?: number
          preco_unit_liquido?: number | null
          quantidade?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_itens_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          created_at: string
          created_by: string | null
          data_orcamento: string | null
          fornecedor_id: string
          id: string
          notas: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_orcamento?: string | null
          fornecedor_id: string
          id?: string
          notas?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_orcamento?: string | null
          fornecedor_id?: string
          id?: string
          notas?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
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
          is_system: boolean
          numero: string
        }
        Insert: {
          created_at?: string
          data_criacao?: string
          descricao: string
          id?: string
          is_system?: boolean
          numero: string
        }
        Update: {
          created_at?: string
          data_criacao?: string
          descricao?: string
          id?: string
          is_system?: boolean
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
      bom_add_child_usage: {
        Args: {
          p_child_root_id: string
          p_notes?: string
          p_parent_root_id: string
          p_position?: number
          p_quantity?: number
        }
        Returns: string
      }
      bom_add_node: {
        Args: {
          p_material_id?: string
          p_name?: string
          p_node_type: Database["public"]["Enums"]["bom_node_type"]
          p_notes?: string
          p_parent_id: string
          p_position?: number
          p_quantity?: number
          p_version_id: string
        }
        Returns: string
      }
      bom_assert_draft: { Args: { p_version_id: string }; Returns: undefined }
      bom_assert_editor: { Args: never; Returns: undefined }
      bom_can_edit: { Args: never; Returns: boolean }
      bom_clone_root: {
        Args: {
          p_codigo: string
          p_label?: string
          p_name: string
          p_notes?: string
          p_source_version_id: string
          p_target_project_id: string
        }
        Returns: {
          root_id: string
          root_node_id: string
          version_id: string
        }[]
      }
      bom_consolidate_materials: {
        Args: { p_root_id: string }
        Returns: {
          material_id: string
          total_qty: number
        }[]
      }
      bom_copy_subtree: {
        Args: {
          p_position?: number
          p_record_origin?: boolean
          p_source_node: string
          p_target_parent: string
          p_target_version: string
        }
        Returns: string
      }
      bom_create_conjunto: {
        Args: {
          p_codigo: string
          p_label?: string
          p_name: string
          p_notes?: string
          p_project_id: string
        }
        Returns: {
          root_id: string
          root_node_id: string
          version_id: string
        }[]
      }
      bom_delete_root: { Args: { p_root_id: string }; Returns: undefined }
      bom_diff_versions: {
        Args: { p_version_a: string; p_version_b: string }
        Returns: {
          change: string
          material_id: string
          name_a: string
          name_b: string
          node_type: Database["public"]["Enums"]["bom_node_type"]
          quantity_a: number
          quantity_b: number
        }[]
      }
      bom_drop_obsolete_version: {
        Args: { p_version_id: string }
        Returns: Json
      }
      bom_drop_root: { Args: { p_root_id: string }; Returns: Json }
      bom_drop_root_cascade: { Args: { p_root_id: string }; Returns: undefined }
      bom_duplicate_subtree: { Args: { p_node_id: string }; Returns: string }
      bom_move_node: {
        Args: {
          p_new_parent: string
          p_new_position: number
          p_node_id: string
        }
        Returns: undefined
      }
      bom_new_version: {
        Args: {
          p_label?: string
          p_notes?: string
          p_root_id: string
          p_source_version_id?: string
        }
        Returns: string
      }
      bom_obsolete_version: {
        Args: { p_version_id: string }
        Returns: undefined
      }
      bom_release_version: {
        Args: { p_version_id: string }
        Returns: undefined
      }
      bom_remove_child_usage: {
        Args: { p_usage_id: string }
        Returns: undefined
      }
      bom_remove_subtree: { Args: { p_node_id: string }; Returns: undefined }
      bom_revert_version_to_draft: {
        Args: { p_version_id: string }
        Returns: Json
      }
      bom_root_set_parent: {
        Args: { p_parent_id: string; p_quantity?: number; p_root_id: string }
        Returns: undefined
      }
      bom_root_set_quantity_in_parent: {
        Args: { p_quantity: number; p_root_id: string }
        Returns: undefined
      }
      bom_root_would_cycle: {
        Args: { p_new_parent: string; p_root_id: string }
        Returns: boolean
      }
      bom_set_standard: {
        Args: { p_is_standard: boolean; p_root_id: string }
        Returns: undefined
      }
      bom_update_node:
        | {
            Args: {
              p_clear_notes?: boolean
              p_name?: string
              p_node_id: string
              p_notes?: string
              p_position?: number
              p_quantity?: number
            }
            Returns: undefined
          }
        | {
            Args: {
              p_clear_name?: boolean
              p_clear_notes?: boolean
              p_material_id?: string
              p_name?: string
              p_node_id: string
              p_notes?: string
              p_position?: number
              p_quantity?: number
            }
            Returns: undefined
          }
      bom_usage_would_cycle: {
        Args: { p_child_root_id: string; p_parent_root_id: string }
        Returns: boolean
      }
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
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role:
        | "admin"
        | "gerente"
        | "projetista"
        | "comprador"
        | "coordenador_campo"
      bom_node_type: "CONJUNTO" | "SUBCONJUNTO" | "ITEM"
      bom_version_status: "DRAFT" | "RELEASED" | "OBSOLETE"
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
      bom_node_type: ["CONJUNTO", "SUBCONJUNTO", "ITEM"],
      bom_version_status: ["DRAFT", "RELEASED", "OBSOLETE"],
    },
  },
} as const
