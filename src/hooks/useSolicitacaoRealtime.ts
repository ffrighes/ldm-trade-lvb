import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Options {
  /** When provided, the toast is suppressed if the actor matches this user id (own change). */
  currentUserId?: string;
}

/**
 * Subscribes to realtime UPDATEs on the given solicitação. When another user
 * changes the status, fires a toast. Always invalidates relevant queries so
 * the form re-fetches itself.
 */
export function useSolicitacaoRealtime(solicitacaoId: string | undefined, opts: Options = {}) {
  const qc = useQueryClient();
  const { currentUserId } = opts;

  useEffect(() => {
    if (!solicitacaoId) return;

    const channel = supabase
      .channel(`solicitacao:${solicitacaoId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'solicitacoes',
          filter: `id=eq.${solicitacaoId}`,
        },
        (payload) => {
          const oldRow = payload.old as { status?: string } | null;
          const newRow = payload.new as { status?: string; numero?: string } | null;
          if (oldRow?.status && newRow?.status && oldRow.status !== newRow.status) {
            toast.info(`Status alterado: ${oldRow.status} → ${newRow.status}`, {
              description: newRow.numero ? `Solicitação ${newRow.numero}` : undefined,
            });
          }
          qc.invalidateQueries({ queryKey: ['solicitacoes', solicitacaoId] });
          qc.invalidateQueries({ queryKey: ['solicitacao_audit', solicitacaoId] });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'solicitacao_comments',
          filter: `solicitacao_id=eq.${solicitacaoId}`,
        },
        (payload) => {
          const row = payload.new as { author_id?: string; author_email?: string } | null;
          if (row?.author_id && row.author_id !== currentUserId) {
            toast.info(`Novo comentário de ${row.author_email ?? 'usuário'}`);
          }
          qc.invalidateQueries({ queryKey: ['solicitacao_comments', solicitacaoId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [solicitacaoId, currentUserId, qc]);
}
