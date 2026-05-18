import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type Fornecedor = Database['public']['Tables']['fornecedores']['Row'];
export type FornecedorPreco = Database['public']['Tables']['fornecedor_precos']['Row'];
export type FornecedorPrecoComMaterial = FornecedorPreco & {
  material: {
    id: string;
    descricao: string;
    bitola: string;
    unidade: string;
  } | null;
};

// ============= FORNECEDORES =============

export function useFornecedores() {
  return useQuery({
    queryKey: ['fornecedores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fornecedores')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data as Fornecedor[];
    },
  });
}

export function useAddFornecedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (f: { nome: string; observacoes?: string }) => {
      const { data, error } = await supabase.from('fornecedores').insert(f).select().single();
      if (error) throw error;
      return data as Fornecedor;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fornecedores'] }),
  });
}

export function useUpdateFornecedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; nome?: string; observacoes?: string }) => {
      const { error } = await supabase.from('fornecedores').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fornecedores'] }),
  });
}

export function useDeleteFornecedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fornecedores').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fornecedores'] });
      qc.invalidateQueries({ queryKey: ['fornecedor_precos'] });
      qc.invalidateQueries({ queryKey: ['fornecedor_item_counts'] });
    },
  });
}

// ============= FORNECEDOR PRECOS =============

export function useFornecedorPrecos(fornecedorId?: string) {
  return useQuery({
    queryKey: ['fornecedor_precos', fornecedorId],
    enabled: !!fornecedorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fornecedor_precos')
        .select('*, material:materials(id, descricao, bitola, unidade)')
        .eq('fornecedor_id', fornecedorId!)
        .order('data_cotacao', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as FornecedorPrecoComMaterial[];
    },
  });
}

export function useAddPreco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      p: Database['public']['Tables']['fornecedor_precos']['Insert'],
    ) => {
      const { data, error } = await supabase.from('fornecedor_precos').insert(p).select().single();
      if (error) throw error;
      return data as FornecedorPreco;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['fornecedor_precos', vars.fornecedor_id] });
      qc.invalidateQueries({ queryKey: ['fornecedor_item_counts'] });
    },
  });
}

export function useUpdatePreco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      fornecedor_id,
      ...data
    }: Database['public']['Tables']['fornecedor_precos']['Update'] & {
      id: string;
      fornecedor_id: string;
    }) => {
      const { error } = await supabase.from('fornecedor_precos').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['fornecedor_precos', vars.fornecedor_id] });
      qc.invalidateQueries({ queryKey: ['fornecedor_item_counts'] });
    },
  });
}

export function useDeletePreco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fornecedor_id }: { id: string; fornecedor_id: string }) => {
      const { error } = await supabase.from('fornecedor_precos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['fornecedor_precos', vars.fornecedor_id] });
      qc.invalidateQueries({ queryKey: ['fornecedor_item_counts'] });
    },
  });
}

export function useFornecedorItemCounts() {
  return useQuery({
    queryKey: ['fornecedor_item_counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fornecedor_precos')
        .select('fornecedor_id, material_id');
      if (error) throw error;
      const counts = new Map<string, number>();
      const seen = new Map<string, Set<string>>();
      for (const row of data) {
        if (!seen.has(row.fornecedor_id)) seen.set(row.fornecedor_id, new Set());
        seen.get(row.fornecedor_id)!.add(row.material_id);
      }
      for (const [fid, mids] of seen.entries()) {
        counts.set(fid, mids.size);
      }
      return counts;
    },
  });
}
