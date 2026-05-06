import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_CATEGORIAS_MATERIAL } from '@/lib/categorias';

const TABLE = 'material_categorias' as never;

export function useCategorias() {
  return useQuery({
    queryKey: ['material_categorias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select('nome')
        .order('nome');
      if (error) throw error;
      const rows = (data ?? []) as unknown as { nome: string }[];
      return rows.map((r) => r.nome);
    },
    placeholderData: [...DEFAULT_CATEGORIAS_MATERIAL],
  });
}

export function useAddCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nome: string) => {
      const trimmed = nome.trim();
      if (!trimmed) throw new Error('Nome da categoria é obrigatório');
      const { error } = await supabase.from(TABLE).insert({ nome: trimmed } as never);
      if (error) throw error;
      return trimmed;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['material_categorias'] }),
  });
}

export function useRenameCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ from, to }: { from: string; to: string }) => {
      const trimmed = to.trim();
      if (!trimmed) throw new Error('Novo nome é obrigatório');
      if (trimmed === from) return;

      const { error: insErr } = await supabase
        .from(TABLE)
        .insert({ nome: trimmed } as never);
      if (insErr && insErr.code !== '23505') throw insErr;

      const { error: matErr } = await supabase
        .from('materials')
        .update({ categoria: trimmed })
        .eq('categoria', from);
      if (matErr) throw matErr;

      const { error: delErr } = await supabase
        .from(TABLE)
        .delete()
        .eq('nome', from);
      if (delErr) throw delErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['material_categorias'] });
      qc.invalidateQueries({ queryKey: ['materials'] });
    },
  });
}

export function useDeleteCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nome: string) => {
      const { error: matErr } = await supabase
        .from('materials')
        .update({ categoria: null })
        .eq('categoria', nome);
      if (matErr) throw matErr;

      const { error } = await supabase.from(TABLE).delete().eq('nome', nome);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['material_categorias'] });
      qc.invalidateQueries({ queryKey: ['materials'] });
    },
  });
}
