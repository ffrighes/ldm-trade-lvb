import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calcOrcamentoTotais } from '@/lib/orcamentoCalc';
import type { Orcamento, OrcamentoItem, OrcamentoComTotais } from '@/types/orcamento';

// As tabelas orcamentos / orcamento_itens ainda não estão nos tipos
// auto-gerados (src/integrations/supabase/types.ts). Usamos acessores não
// tipados via este shim mínimo, espelhando o padrão de src/hooks/useBomTree.ts.
// Regenerar os tipos do Supabase remove a necessidade dos casts.
type AnyRecord = Record<string, unknown>;
interface QueryBuilderLike {
  select: (q?: string) => QueryBuilderLike;
  insert: (v: AnyRecord) => QueryBuilderLike;
  update: (v: AnyRecord) => QueryBuilderLike;
  delete: () => QueryBuilderLike;
  eq: (col: string, val: unknown) => QueryBuilderLike;
  order: (col: string, opts?: { ascending: boolean }) => QueryBuilderLike;
  single: () => QueryBuilderLike;
  then: <T>(onfulfilled: (v: { data: unknown; error: unknown }) => T) => Promise<T>;
}
const sb = supabase as unknown as {
  from: (table: string) => QueryBuilderLike;
};

type ItemForCalc = Pick<
  OrcamentoItem,
  'quantidade' | 'preco_unit_com_impostos' | 'icms_pct' | 'pis_cofins_pct' | 'ipi_pct'
>;

function toCalcInput(i: ItemForCalc) {
  return {
    quantidade: Number(i.quantidade) || 0,
    precoUnitComImpostos: Number(i.preco_unit_com_impostos) || 0,
    icmsPct: Number(i.icms_pct) || 0,
    pisCofinsPct: Number(i.pis_cofins_pct) || 0,
    ipiPct: Number(i.ipi_pct) || 0,
  };
}

// --------------------------------------------------------------------- queries

/** Lista de cabeçalhos com nome do fornecedor e totais agregados (calculados no cliente). */
export function useOrcamentos() {
  return useQuery({
    queryKey: ['orcamentos'],
    queryFn: async (): Promise<OrcamentoComTotais[]> => {
      const { data: orcRows, error: orcErr } = await sb
        .from('orcamentos')
        .select('*, fornecedores(nome)')
        .order('created_at', { ascending: false });
      if (orcErr) throw orcErr;
      const orcamentos = (orcRows ?? []) as (Orcamento & {
        fornecedores: { nome: string } | null;
      })[];

      const { data: itemRows, error: itemErr } = await sb
        .from('orcamento_itens')
        .select('orcamento_id, quantidade, preco_unit_com_impostos, icms_pct, pis_cofins_pct, ipi_pct');
      if (itemErr) throw itemErr;
      const itens = (itemRows ?? []) as (ItemForCalc & { orcamento_id: string })[];

      const byOrc = new Map<string, ItemForCalc[]>();
      for (const it of itens) {
        const arr = byOrc.get(it.orcamento_id) ?? [];
        arr.push(it);
        byOrc.set(it.orcamento_id, arr);
      }

      return orcamentos.map((o) => {
        const linhas = byOrc.get(o.id) ?? [];
        const totais = calcOrcamentoTotais(linhas.map(toCalcInput));
        return {
          ...o,
          fornecedor_nome: o.fornecedores?.nome ?? '[Dados Insuficientes]',
          itens_count: linhas.length,
          total_liquido: totais.totalLiquido,
          total_com_impostos: totais.totalComImpostos,
        };
      });
    },
  });
}

export function useOrcamento(id: string | undefined) {
  return useQuery({
    queryKey: ['orcamento', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await sb
        .from('orcamentos')
        .select('*, fornecedores(nome)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Orcamento & { fornecedores: { nome: string } | null };
    },
  });
}

export function useOrcamentoItens(orcamentoId: string | undefined) {
  return useQuery({
    queryKey: ['orcamento-itens', orcamentoId],
    enabled: !!orcamentoId,
    queryFn: async () => {
      const { data, error } = await sb
        .from('orcamento_itens')
        .select('*')
        .eq('orcamento_id', orcamentoId)
        .order('position');
      if (error) throw error;
      return (data ?? []) as OrcamentoItem[];
    },
  });
}

// ------------------------------------------------------------------- mutations

export function useAddOrcamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (o: { fornecedor_id: string; data_orcamento?: string | null; notas?: string | null }) => {
      const { data, error } = await sb
        .from('orcamentos')
        .insert({
          fornecedor_id: o.fornecedor_id,
          data_orcamento: o.data_orcamento ?? null,
          notas: o.notas ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Orcamento;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orcamentos'] }),
  });
}

export function useUpdateOrcamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...fields
    }: {
      id: string;
      fornecedor_id?: string;
      data_orcamento?: string | null;
      notas?: string | null;
    }) => {
      const { error } = await sb.from('orcamentos').update(fields).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['orcamentos'] });
      qc.invalidateQueries({ queryKey: ['orcamento', vars.id] });
    },
  });
}

export function useDeleteOrcamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('orcamentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orcamentos'] }),
  });
}

// preco_unit_liquido é coluna GERADA no banco — nunca enviar em insert/update.
type OrcamentoItemWrite = {
  material_id?: string | null;
  quantidade?: number;
  preco_unit_com_impostos?: number;
  icms_pct?: number;
  pis_cofins_pct?: number;
  ipi_pct?: number;
  notas?: string | null;
  position?: number;
};

export function useAddOrcamentoItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: OrcamentoItemWrite & { orcamento_id: string }) => {
      const { data, error } = await sb.from('orcamento_itens').insert(item).select().single();
      if (error) throw error;
      return data as OrcamentoItem;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['orcamento-itens', vars.orcamento_id] });
      qc.invalidateQueries({ queryKey: ['orcamentos'] });
    },
  });
}

export function useUpdateOrcamentoItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      orcamento_id: _orcamentoId,
      ...fields
    }: OrcamentoItemWrite & { id: string; orcamento_id: string }) => {
      const { error } = await sb.from('orcamento_itens').update(fields).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['orcamento-itens', vars.orcamento_id] });
      qc.invalidateQueries({ queryKey: ['orcamentos'] });
    },
  });
}

export function useDeleteOrcamentoItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, orcamento_id: _orcamentoId }: { id: string; orcamento_id: string }) => {
      const { error } = await sb.from('orcamento_itens').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['orcamento-itens', vars.orcamento_id] });
      qc.invalidateQueries({ queryKey: ['orcamentos'] });
    },
  });
}
