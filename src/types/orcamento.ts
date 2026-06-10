// Tipos da app para o recurso de Orçamentos (cotações de fornecedor).
// As tabelas orcamentos / orcamento_itens ainda não estão em
// src/integrations/supabase/types.ts — os hooks usam um shim de cast
// (ver useOrcamentos.ts). Regenerar os tipos do Supabase remove a necessidade
// destas interfaces manuais.

export interface Fornecedor {
  id: string;
  nome: string;
  observacoes: string;
  created_at: string;
  created_by: string | null;
}

export interface Orcamento {
  id: string;
  fornecedor_id: string;
  data_orcamento: string | null;
  notas: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrcamentoItem {
  id: string;
  orcamento_id: string;
  material_id: string | null;
  quantidade: number;
  preco_unit_com_impostos: number;
  icms_pct: number;
  pis_cofins_pct: number;
  ipi_pct: number;
  notas: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  /** Coluna gerada no banco (premissa "por dentro"). */
  preco_unit_liquido: number;
}

/** Cabeçalho com o nome do fornecedor e totais agregados (calculados no cliente). */
export interface OrcamentoComTotais extends Orcamento {
  fornecedor_nome: string;
  itens_count: number;
  total_liquido: number;
  total_com_impostos: number;
}
