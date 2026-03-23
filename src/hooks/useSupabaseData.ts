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
    mutationFn: async (m: { descricao: string; bitola: string; unidade: string; erp: string; custo: number; notas: string }) => {
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
    mutationFn: async ({ id, ...data }: { id: string; descricao?: string; bitola?: string; unidade?: string; erp?: string; custo?: number; notas?: string }) => {
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
  notas?: string;
  quantidade: number;
  unidade: string;
  custo_unitario: number;
  custo_total: number;
  solicitacao_id: string;
};

/** Insert items; if DB column 'notas' doesn't exist yet, retry without it. */
async function insertItens(rows: ItemInput[]) {
  const { error } = await supabase.from('solicitacao_itens').insert(rows);
  if (error) {
    if (error.message?.includes('notas')) {
      const rowsSemNotas = rows.map(({ notas: _n, ...r }) => r);
      const { error: err2 } = await supabase.from('solicitacao_itens').insert(rowsSemNotas);
      if (err2) throw err2;
    } else {
      throw error;
    }
  }
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
        notas?: string;
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
        notas?: string;
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
