import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ============= MATERIALS =============

export function useMaterials() {
  return useQuery({
    queryKey: ['materials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .order('descricao');
      if (error) throw error;
      return data;
    },
  });
}

export function useAddMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: { descricao: string; bitola: string; unidade: string; erp: string; custo: number; notas: string; categoria?: string | null }) => {
      const { data, error } = await supabase.from('materials').insert(m).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['materials'] }),
  });
}

export function useUpdateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; descricao?: string; bitola?: string; unidade?: string; erp?: string; custo?: number; notas?: string; categoria?: string | null }) => {
      const { error } = await supabase.from('materials').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['materials'] }),
  });
}

export function useDeleteMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('materials').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['materials'] }),
  });
}

// ============= PROJECTS =============

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAddProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { numero: string; descricao: string }) => {
      const { data, error } = await supabase.from('projects').insert(p).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; numero?: string; descricao?: string }) => {
      const { error } = await supabase.from('projects').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

// ============= SOLICITACOES =============

export function useSolicitacoes() {
  return useQuery({
    queryKey: ['solicitacoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solicitacoes')
        .select('*, solicitacao_itens(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export type SolicitacoesSortField =
  | 'numero'
  | 'data_solicitacao'
  | 'status'
  | 'erp'
  | 'created_at';

export interface SolicitacoesQueryParams {
  page: number;
  pageSize: number;
  sortBy: SolicitacoesSortField;
  sortDir: 'asc' | 'desc';
  search?: string;
  status?: string[];
  projetoId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// PostgREST .or() uses `,` and `()` as separators. Strip them from the user
// input rather than trying to escape, since they have no business in a search
// query and would otherwise corrupt the filter expression.
function sanitizeForOrFilter(s: string): string {
  return s.replace(/[,()*]/g, ' ').trim();
}

export function useSolicitacoesPaginated(params: SolicitacoesQueryParams) {
  return useQuery({
    queryKey: ['solicitacoes', 'list', params],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { page, pageSize, sortBy, sortDir, search, status, projetoId, dateFrom, dateTo } = params;
      const from = page * pageSize;
      const to = from + pageSize - 1;

      let projectIdsForSearch: string[] | null = null;
      const cleanSearch = search ? sanitizeForOrFilter(search) : '';
      if (cleanSearch) {
        const { data: matched, error: pErr } = await supabase
          .from('projects')
          .select('id')
          .or(`numero.ilike.%${cleanSearch}%,descricao.ilike.%${cleanSearch}%`);
        if (pErr) throw pErr;
        projectIdsForSearch = (matched ?? []).map((p) => p.id);
      }

      let query = supabase
        .from('solicitacoes')
        .select('*, solicitacao_itens(*)', { count: 'exact' });

      if (status && status.length > 0) query = query.in('status', status);
      if (projetoId) query = query.eq('projeto_id', projetoId);
      if (dateFrom) query = query.gte('data_solicitacao', dateFrom);
      if (dateTo) query = query.lte('data_solicitacao', dateTo);

      if (cleanSearch) {
        const orParts = [
          `numero.ilike.%${cleanSearch}%`,
          `motivo.ilike.%${cleanSearch}%`,
          `erp.ilike.%${cleanSearch}%`,
        ];
        if (projectIdsForSearch && projectIdsForSearch.length > 0) {
          orParts.push(`projeto_id.in.(${projectIdsForSearch.join(',')})`);
        }
        query = query.or(orParts.join(','));
      }

      query = query.order(sortBy, { ascending: sortDir === 'asc' }).range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: data ?? [], total: count ?? 0 };
    },
  });
}

export interface SolicitacoesKpis {
  total_solicitacoes: number;
  total_abertas: number;
  valor_abertas: number;
  valor_total: number;
  itens_pendentes: number;
  ticket_medio: number;
}

export function useSolicitacoesKpis(params: Omit<SolicitacoesQueryParams, 'page' | 'pageSize' | 'sortBy' | 'sortDir'>) {
  return useQuery({
    queryKey: ['solicitacoes', 'kpis', params],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { search, status, projetoId, dateFrom, dateTo } = params;
      const cleanSearch = search ? search.replace(/[,()*]/g, ' ').trim() : '';

      let projectIdsForSearch: string[] | null = null;
      if (cleanSearch) {
        const { data: matched, error: pErr } = await supabase
          .from('projects')
          .select('id')
          .or(`numero.ilike.%${cleanSearch}%,descricao.ilike.%${cleanSearch}%`);
        if (pErr) throw pErr;
        projectIdsForSearch = (matched ?? []).map((p) => p.id);
      }

      const { data, error } = await supabase.rpc('get_solicitacoes_kpis', {
        p_search: cleanSearch || null,
        p_status: status && status.length > 0 ? status : null,
        p_projeto: projetoId || null,
        p_from: dateFrom || null,
        p_to: dateTo || null,
        p_project_ids: projectIdsForSearch,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      // Postgres returns numeric/bigint as strings; coerce to number.
      const k = (row ?? {}) as Record<string, string | number | null>;
      const num = (v: string | number | null | undefined) => Number(v ?? 0);
      const result: SolicitacoesKpis = {
        total_solicitacoes: num(k.total_solicitacoes),
        total_abertas: num(k.total_abertas),
        valor_abertas: num(k.valor_abertas),
        valor_total: num(k.valor_total),
        itens_pendentes: num(k.itens_pendentes),
        ticket_medio: num(k.ticket_medio),
      };
      return result;
    },
  });
}

// ============= SOLICITAÇÃO SAVED VIEWS =============

export interface SavedView {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  created_at: string;
}

export function useSavedViews() {
  return useQuery({
    queryKey: ['solicitacao_saved_views'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solicitacao_saved_views' as never)
        .select('id, name, filters, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SavedView[];
    },
  });
}

export function useSaveView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, filters }: { name: string; filters: Record<string, unknown> }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      const { error } = await supabase
        .from('solicitacao_saved_views' as never)
        .upsert({ user_id: user.id, name, filters } as never, { onConflict: 'user_id,name' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['solicitacao_saved_views'] }),
  });
}

export function useDeleteSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('solicitacao_saved_views' as never).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['solicitacao_saved_views'] }),
  });
}

export function useSolicitacao(id: string | undefined) {
  return useQuery({
    queryKey: ['solicitacoes', id],
    enabled: !!id && id !== 'nova',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solicitacoes')
        .select('*, solicitacao_itens(*)')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

type ItemInput = {
  material_id?: string | null;
  descricao: string;
  bitola: string;
  erp?: string;
  notas?: string;
  tag?: string;
  quantidade: number;
  unidade: string;
  custo_unitario: number;
  custo_total: number;
  solicitacao_id: string;
};

async function insertItens(rows: ItemInput[]) {
  const { error } = await supabase.from('solicitacao_itens').insert(rows);
  if (error) throw error;
}

export function useAddSolicitacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      projeto_id: string;
      motivo: string;
      data_solicitacao: string;
      revisao: string;
      erp: string;
      notas: string;
      status: string;
      desenho?: string | null;
      itens: Array<{
        material_id?: string | null;
        descricao: string;
        bitola: string;
        erp?: string;
        notas?: string;
        tag?: string;
        quantidade: number;
        unidade: string;
        custo_unitario: number;
        custo_total: number;
      }>;
    }) => {
      const { itens, ...solData } = input;
      // numero is auto-generated by trigger, but we need a placeholder
      const { data: sol, error } = await supabase
        .from('solicitacoes')
        .insert({ ...solData, numero: 'TEMP' })
        .select()
        .single();
      if (error) throw error;

      if (itens.length > 0) {
        await insertItens(itens.map(i => ({ ...i, solicitacao_id: sol.id })));
      }
      return sol;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['solicitacoes'] }),
  });
}

export function useUpdateSolicitacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      projeto_id: string;
      motivo: string;
      data_solicitacao: string;
      revisao: string;
      erp: string;
      notas: string;
      status: string;
      desenho?: string | null;
      itens: Array<{
        material_id?: string | null;
        descricao: string;
        bitola: string;
        erp?: string;
        notas?: string;
        tag?: string;
        quantidade: number;
        unidade: string;
        custo_unitario: number;
        custo_total: number;
      }>;
    }) => {
      const { id, itens, ...solData } = input;
      const { error } = await supabase.from('solicitacoes').update(solData).eq('id', id);
      if (error) throw error;

      // Replace all items
      const { error: delError } = await supabase.from('solicitacao_itens').delete().eq('solicitacao_id', id);
      if (delError) throw delError;

      if (itens.length > 0) {
        await insertItens(itens.map(i => ({ ...i, solicitacao_id: id })));
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['solicitacoes'] }),
  });
}

export function useUpdateSolicitacaoItemCosts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: Array<{ id: string; custo_unitario: number; custo_total: number }>) => {
      for (const item of items) {
        const { error } = await supabase
          .from('solicitacao_itens')
          .update({ custo_unitario: item.custo_unitario, custo_total: item.custo_total })
          .eq('id', item.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['solicitacoes'] }),
  });
}

// ============= INVENTARIO =============

export function useAddInventarioAjuste() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ajuste: {
      projeto_id: string;
      descricao: string;
      bitola: string;
      unidade: string;
      quantidade: number;
      custo_unitario: number;
      custo_total: number;
      material_id?: string | null;
      erp?: string;
    }) => {
      const { error } = await supabase.from('inventario').insert({
        ...ajuste,
        solicitacao_id: null,
        tipo: 'ajuste',
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['inventario', variables.projeto_id] });
      toast.success('Ajuste de estoque registrado.');
    },
    onError: () => toast.error('Erro ao registrar ajuste de estoque.'),
  });
}

export function useDeleteInventarioItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, projeto_id }: { ids: string[]; projeto_id: string }) => {
      const { error } = await supabase.from('inventario').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['inventario', variables.projeto_id] });
      toast.success('Item removido do inventário.');
    },
    onError: () => toast.error('Erro ao remover item do inventário.'),
  });
}

export function useDeleteSolicitacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('solicitacoes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['solicitacoes'] }),
  });
}

// ============= BULK SOLICITAÇÃO ACTIONS =============

export function useBulkUpdateSolicitacaoStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      if (ids.length === 0) return;
      // Single statement → atomic; the existing per-row trigger
      // (Finalizada → inventário) fires for each affected row.
      const { error } = await supabase.from('solicitacoes').update({ status }).in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['solicitacoes'] }),
  });
}

export function useBulkDeleteSolicitacoes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase.from('solicitacoes').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['solicitacoes'] }),
  });
}

export function useSolicitacoesByIds(ids: string[]) {
  return useQuery({
    queryKey: ['solicitacoes', 'by-ids', ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solicitacoes')
        .select('*, solicitacao_itens(*)')
        .in('id', ids);
      if (error) throw error;
      return data ?? [];
    },
  });
}
