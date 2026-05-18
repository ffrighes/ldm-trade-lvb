import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Orcamento = Tables<'orcamentos'>;
export type OrcamentoItem = Tables<'orcamento_itens'>;
export type OrcamentoFornecedor = Tables<'orcamento_fornecedores'>;
export type OrcamentoItemCotacao = Tables<'orcamento_item_cotacoes'>;

export interface OrcamentoDetalhe extends Orcamento {
  projeto: { numero: string; descricao: string } | null;
  itens: OrcamentoItem[];
  fornecedores: Array<OrcamentoFornecedor & { fornecedor: { id: string; nome: string; regime_tributario: string } }>;
  cotacoes: OrcamentoItemCotacao[];
}

const KEYS = {
  all: ['orcamentos'] as const,
  lista: (projetoId?: string) => ['orcamentos', 'lista', projetoId ?? 'all'] as const,
  detalhe: (id: string) => ['orcamentos', id] as const,
};

// ---- Queries ----

export function useOrcamentos(projetoId?: string) {
  return useQuery({
    queryKey: KEYS.lista(projetoId),
    queryFn: async () => {
      let q = supabase
        .from('orcamentos')
        .select('*, projeto:projects(numero, descricao)')
        .order('created_at', { ascending: false });
      if (projetoId) q = q.eq('projeto_id', projetoId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useOrcamento(id: string) {
  return useQuery({
    queryKey: KEYS.detalhe(id),
    enabled: !!id,
    queryFn: async (): Promise<OrcamentoDetalhe> => {
      const [orcRes, itensRes, fornRes, cotRes] = await Promise.all([
        supabase
          .from('orcamentos')
          .select('*, projeto:projects(numero, descricao)')
          .eq('id', id)
          .single(),
        supabase
          .from('orcamento_itens')
          .select('*')
          .eq('orcamento_id', id)
          .order('posicao'),
        supabase
          .from('orcamento_fornecedores')
          .select('*, fornecedor:fornecedores(id, nome, regime_tributario)')
          .eq('orcamento_id', id)
          .order('posicao'),
        supabase
          .from('orcamento_item_cotacoes')
          .select('*')
          .in(
            'item_id',
            (await supabase.from('orcamento_itens').select('id').eq('orcamento_id', id)).data?.map((i) => i.id) ?? [],
          ),
      ]);
      if (orcRes.error) throw orcRes.error;
      return {
        ...(orcRes.data as Orcamento & { projeto: { numero: string; descricao: string } | null }),
        itens: itensRes.data ?? [],
        fornecedores: (fornRes.data ?? []) as OrcamentoDetalhe['fornecedores'],
        cotacoes: cotRes.data ?? [],
      };
    },
  });
}

// ---- Mutations ----

export function useCreateOrcamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TablesInsert<'orcamentos'>) => {
      const { data, error } = await supabase
        .from('orcamentos')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as Orcamento;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useUpdateOrcamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: TablesUpdate<'orcamentos'> & { id: string }) => {
      const { data, error } = await supabase
        .from('orcamentos')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Orcamento;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: KEYS.detalhe(data.id) });
    },
  });
}

export function useDeleteOrcamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('orcamentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useCopyBomToOrcamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      bomVersionId,
      orcamentoId,
    }: {
      bomVersionId: string;
      orcamentoId: string;
    }) => {
      const { data, error } = await supabase.rpc('copy_bom_to_orcamento', {
        p_bom_version_id: bomVersionId,
        p_orcamento_id: orcamentoId,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.detalhe(vars.orcamentoId) });
    },
  });
}

export function useAddOrcamentoItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TablesInsert<'orcamento_itens'>) => {
      const { data, error } = await supabase
        .from('orcamento_itens')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as OrcamentoItem;
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: KEYS.detalhe(data.orcamento_id) }),
  });
}

export function useUpdateOrcamentoItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, orcamento_id, ...patch }: TablesUpdate<'orcamento_itens'> & { id: string; orcamento_id: string }) => {
      const { data, error } = await supabase
        .from('orcamento_itens')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return { ...(data as OrcamentoItem), orcamento_id };
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: KEYS.detalhe(data.orcamento_id) }),
  });
}

export function useDeleteOrcamentoItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, orcamentoId }: { id: string; orcamentoId: string }) => {
      const { error } = await supabase.from('orcamento_itens').delete().eq('id', id);
      if (error) throw error;
      return orcamentoId;
    },
    onSuccess: (orcamentoId) => qc.invalidateQueries({ queryKey: KEYS.detalhe(orcamentoId) }),
  });
}

export function useSetOrcamentoFornecedores() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orcamentoId,
      fornecedorIds,
    }: {
      orcamentoId: string;
      fornecedorIds: string[];
    }) => {
      // Delete all and re-insert in one round-trip
      const { error: delErr } = await supabase
        .from('orcamento_fornecedores')
        .delete()
        .eq('orcamento_id', orcamentoId);
      if (delErr) throw delErr;

      if (fornecedorIds.length === 0) return;

      const rows = fornecedorIds.map((fid, idx) => ({
        orcamento_id: orcamentoId,
        fornecedor_id: fid,
        posicao: idx,
      }));
      const { error: insErr } = await supabase.from('orcamento_fornecedores').insert(rows);
      if (insErr) throw insErr;
    },
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: KEYS.detalhe(vars.orcamentoId) }),
  });
}

export function useUpsertOrcamentoItemCotacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orcamentoId,
      ...input
    }: TablesInsert<'orcamento_item_cotacoes'> & { orcamentoId: string }) => {
      const { data, error } = await supabase
        .from('orcamento_item_cotacoes')
        .upsert(input, { onConflict: 'item_id,fornecedor_id' })
        .select()
        .single();
      if (error) throw error;
      return { data: data as OrcamentoItemCotacao, orcamentoId };
    },
    onSuccess: (res) => qc.invalidateQueries({ queryKey: KEYS.detalhe(res.orcamentoId) }),
  });
}

/**
 * Para cada (itemId × fornecedorId), busca a cotação mais recente em BRL de
 * fornecedor_precos (vigência = MAX(data_cotacao) por par).
 */
export function useFetchVigenteCotacoes(materialIds: string[], fornecedorIds: string[]) {
  return useQuery({
    queryKey: ['fornecedor_precos_vigentes', materialIds, fornecedorIds],
    enabled: materialIds.length > 0 && fornecedorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fornecedor_precos')
        .select('*')
        .in('material_id', materialIds)
        .in('fornecedor_id', fornecedorIds)
        .eq('moeda', 'BRL')
        .order('data_cotacao', { ascending: false });
      if (error) throw error;

      // Reduz para a cotação mais recente por (fornecedor_id, material_id)
      const map = new Map<string, typeof data[0]>();
      for (const row of data ?? []) {
        const key = `${row.fornecedor_id}|${row.material_id}`;
        if (!map.has(key)) map.set(key, row);
      }
      return [...map.values()];
    },
  });
}

/** Aplica cotações vigentes em batch para todos os itens × fornecedores do orçamento. */
export function useApplyCotacoes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orcamentoId,
      itens,
      fornecedorIds,
      cotacoesVigentes,
    }: {
      orcamentoId: string;
      itens: OrcamentoItem[];
      fornecedorIds: string[];
      cotacoesVigentes: Array<{
        id: string;
        fornecedor_id: string;
        material_id: string;
        codigo_fornecedor: string;
        valor_unitario: number;
        desconto_pct: number;
        ipi_pct: number;
        icms_pct: number;
        pis_pct: number;
        cofins_pct: number;
        moq: number;
        lead_time_dias: number;
      }>;
    }) => {
      const rows: TablesInsert<'orcamento_item_cotacoes'>[] = [];

      for (const item of itens) {
        for (const fid of fornecedorIds) {
          const cot = item.material_id
            ? cotacoesVigentes.find(
                (c) => c.fornecedor_id === fid && c.material_id === item.material_id,
              )
            : undefined;

          rows.push({
            item_id: item.id,
            fornecedor_id: fid,
            cotacao_origem_id: cot?.id ?? null,
            codigo_fornecedor: cot?.codigo_fornecedor ?? '',
            valor_unitario: cot?.valor_unitario ?? 0,
            desconto_pct: cot?.desconto_pct ?? 0,
            ipi_pct: cot?.ipi_pct ?? 0,
            icms_pct: cot?.icms_pct ?? 0,
            pis_pct: cot?.pis_pct ?? 0,
            cofins_pct: cot?.cofins_pct ?? 0,
            moq: cot?.moq ?? null,
            lead_time_dias: cot?.lead_time_dias ?? null,
            sem_cotacao_vigente: !cot,
          });
        }
      }

      if (rows.length === 0) return;

      const { error } = await supabase
        .from('orcamento_item_cotacoes')
        .upsert(rows, { onConflict: 'item_id,fornecedor_id' });
      if (error) throw error;
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: KEYS.detalhe(vars.orcamentoId) }),
  });
}
