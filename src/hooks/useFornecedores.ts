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
