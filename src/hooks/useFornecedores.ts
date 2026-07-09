import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Fornecedor } from '@/types/orcamento';

// As tabelas de fornecedores ainda não estão nos tipos auto-gerados
// (src/integrations/supabase/types.ts). Usamos acessores não tipados via
// este shim mínimo, espelhando o padrão de src/hooks/useBomTree.ts.
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

export function useFornecedores() {
  return useQuery({
    queryKey: ['fornecedores'],
    queryFn: async () => {
      const { data, error } = await sb.from('fornecedores').select('*').order('nome');
      if (error) throw error;
      return (data ?? []) as Fornecedor[];
    },
  });
}

export function useAddFornecedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (f: { nome: string; observacoes?: string }) => {
      const { data, error } = await sb
        .from('fornecedores')
        .insert({ nome: f.nome, observacoes: f.observacoes ?? '' })
        .select()
        .single();
      if (error) throw error;
      return data as Fornecedor;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fornecedores'] }),
  });
}

export function useRenameFornecedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const trimmed = nome.trim();
      if (!trimmed) throw new Error('Novo nome é obrigatório');
      const { error } = await sb
        .from('fornecedores')
        .update({ nome: trimmed })
        .eq('id', id);
      if (error) throw error;
    },
    // Optimistic update: renomeia na cache antes da confirmação do servidor.
    onMutate: async ({ id, nome }: { id: string; nome: string }) => {
      await qc.cancelQueries({ queryKey: ['fornecedores'] });
      const previous = qc.getQueryData<Fornecedor[]>(['fornecedores']);
      const trimmed = nome.trim();
      qc.setQueryData<Fornecedor[]>(['fornecedores'], (old) =>
        (old ?? []).map((f) => (f.id === id ? { ...f, nome: trimmed } : f)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(['fornecedores'], context.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['fornecedores'] });
      qc.invalidateQueries({ queryKey: ['materials'] });
    },
  });
}

export function useDeleteFornecedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // materials.fornecedor_id tem ON DELETE SET NULL — remover o fornecedor
      // desvincula os materiais automaticamente no banco.
      const { error } = await sb.from('fornecedores').delete().eq('id', id);
      if (error) throw error;
    },
    // Optimistic update: remove da cache antes da confirmação do servidor.
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ['fornecedores'] });
      const previous = qc.getQueryData<Fornecedor[]>(['fornecedores']);
      qc.setQueryData<Fornecedor[]>(['fornecedores'], (old) =>
        (old ?? []).filter((f) => f.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) qc.setQueryData(['fornecedores'], context.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['fornecedores'] });
      qc.invalidateQueries({ queryKey: ['materials'] });
    },
  });
}
