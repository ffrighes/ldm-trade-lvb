import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Resolves legacy /solicitacoes/:id URLs by looking up the projeto_id and
 * redirecting to the nested /projetos/:projetoId/solicitacoes/:id route.
 * If the id is "nova" or unresolvable, falls back to /projetos.
 */
export default function LegacySolicitacaoRedirect() {
  const { id } = useParams();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!id || id === 'nova') {
      setTarget('/projetos');
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from('solicitacoes')
        .select('projeto_id')
        .eq('id', id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data?.projeto_id) {
        setTarget('/projetos');
      } else {
        setTarget(`/projetos/${data.projeto_id}/solicitacoes/${id}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!target) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Redirecionando…
      </div>
    );
  }
  return <Navigate to={target} replace />;
}
