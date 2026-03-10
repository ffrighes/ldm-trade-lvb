import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useInventario(projectId: string) {
  return useQuery({
    queryKey: ['inventario', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventario')
        .select('*, solicitacoes(numero)')
        .eq('projeto_id', projectId)
        .order('created_at');
      if (error) throw error;
      return data.map(item => ({
        ...item,
        solicitacao_numero: (item.solicitacoes as any)?.numero ?? '',
      }));
    },
  });
}
