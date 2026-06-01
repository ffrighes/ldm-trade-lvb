import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export interface CalculoValor {
  nome: string;
  valor: number | string;
  unidade: string;
}

type CalculoRow = Database['public']['Tables']['calculos']['Row'];

export interface Calculo extends Omit<CalculoRow, 'valores' | 'status'> {
  valores: CalculoValor[];
  status: 'Rascunho' | 'Em Revisão' | 'Aprovado';
}

export type InsertCalculo = Omit<Calculo, 'id' | 'autor_id' | 'created_at' | 'updated_at'>;
export type UpdateCalculo = Partial<Omit<Calculo, 'id' | 'projeto_id' | 'autor_id' | 'created_at' | 'updated_at'>>;

export function useCalculos(projetoId: string | undefined) {
  return useQuery({
    queryKey: ['calculos', projetoId],
    enabled: !!projetoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calculos')
        .select('*')
        .eq('projeto_id', projetoId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Calculo[];
    },
  });
}

export function useAddCalculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: InsertCalculo) => {
      const { data, error } = await supabase
        .from('calculos')
        .insert(payload as Database['public']['Tables']['calculos']['Insert'])
        .select()
        .single();
      if (error) throw error;
      return data as Calculo;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['calculos', variables.projeto_id] });
    },
  });
}

export function useUpdateCalculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projetoId, ...data }: UpdateCalculo & { id: string; projetoId: string }) => {
      const { error } = await supabase
        .from('calculos')
        .update(data as Database['public']['Tables']['calculos']['Update'])
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['calculos', variables.projetoId] });
    },
  });
}

export function useDeleteCalculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projetoId: _projetoId }: { id: string; projetoId: string }) => {
      const { error } = await supabase
        .from('calculos')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['calculos', variables.projetoId] });
    },
  });
}
