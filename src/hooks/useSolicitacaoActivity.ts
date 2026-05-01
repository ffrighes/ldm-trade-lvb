import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ============= AUDIT =============

export interface SolicitacaoAuditEntry {
  id: number;
  solicitacao_id: string | null;
  solicitacao_numero: string | null;
  actor_id: string | null;
  actor_email: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  changed_fields: string[] | null;
  at: string;
}

export function useSolicitacaoAudit(solicitacaoId: string | undefined) {
  return useQuery({
    queryKey: ['solicitacao_audit', solicitacaoId],
    enabled: !!solicitacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solicitacao_audit' as never)
        .select('*')
        .eq('solicitacao_id', solicitacaoId!)
        .order('at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SolicitacaoAuditEntry[];
    },
  });
}

// ============= COMMENTS =============

export interface SolicitacaoComment {
  id: string;
  solicitacao_id: string;
  author_id: string | null;
  author_email: string;
  body: string;
  created_at: string;
}

export function useSolicitacaoComments(solicitacaoId: string | undefined) {
  return useQuery({
    queryKey: ['solicitacao_comments', solicitacaoId],
    enabled: !!solicitacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solicitacao_comments' as never)
        .select('*')
        .eq('solicitacao_id', solicitacaoId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SolicitacaoComment[];
    },
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ solicitacaoId, body }: { solicitacaoId: string; body: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) throw new Error('Não autenticado');
      const { error } = await supabase
        .from('solicitacao_comments' as never)
        .insert({
          solicitacao_id: solicitacaoId,
          author_id: user.id,
          author_email: user.email ?? '',
          body: body.trim(),
        } as never);
      if (error) throw error;
    },
    onSuccess: (_, { solicitacaoId }) => {
      qc.invalidateQueries({ queryKey: ['solicitacao_comments', solicitacaoId] });
    },
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; solicitacaoId: string }) => {
      const { error } = await supabase.from('solicitacao_comments' as never).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { solicitacaoId }) => {
      qc.invalidateQueries({ queryKey: ['solicitacao_comments', solicitacaoId] });
    },
  });
}

// ============= DRAWINGS (multi-revision) =============

export interface SolicitacaoDrawing {
  id: string;
  solicitacao_id: string;
  revisao: string;
  url: string;
  storage_path: string | null;
  notas: string | null;
  uploaded_by: string | null;
  uploaded_by_email: string | null;
  uploaded_at: string;
}

export function useSolicitacaoDrawings(solicitacaoId: string | undefined) {
  return useQuery({
    queryKey: ['solicitacao_drawings', solicitacaoId],
    enabled: !!solicitacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solicitacao_drawings' as never)
        .select('*')
        .eq('solicitacao_id', solicitacaoId!)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SolicitacaoDrawing[];
    },
  });
}

export function useUploadDrawing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      solicitacaoId,
      file,
      revisao,
      notas,
    }: {
      solicitacaoId: string;
      file: File;
      revisao: string;
      notas?: string;
    }) => {
      if (file.type !== 'application/pdf') throw new Error('Apenas arquivos PDF são permitidos');

      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) throw new Error('Não autenticado');

      const safeRev = revisao.replace(/[^a-zA-Z0-9._-]/g, '_') || 'rev';
      const storagePath = `${solicitacaoId}/${Date.now()}-${safeRev}-${file.name}`;

      const { error: upErr } = await supabase.storage.from('desenhos').upload(storagePath, file);
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from('desenhos').getPublicUrl(storagePath);
      const url = urlData.publicUrl;

      const { error: insErr } = await supabase
        .from('solicitacao_drawings' as never)
        .insert({
          solicitacao_id: solicitacaoId,
          revisao: revisao.trim(),
          url,
          storage_path: storagePath,
          notas: notas?.trim() || null,
          uploaded_by: user.id,
          uploaded_by_email: user.email ?? '',
        } as never);
      if (insErr) {
        // Best-effort cleanup if the DB row failed.
        await supabase.storage.from('desenhos').remove([storagePath]).catch(() => undefined);
        throw insErr;
      }
    },
    onSuccess: (_, { solicitacaoId }) => {
      qc.invalidateQueries({ queryKey: ['solicitacao_drawings', solicitacaoId] });
    },
  });
}

export function useDeleteDrawing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, storagePath }: { id: string; solicitacaoId: string; storagePath: string | null }) => {
      const { error } = await supabase.from('solicitacao_drawings' as never).delete().eq('id', id);
      if (error) throw error;
      // Best-effort: remove the file from storage too. If RLS blocks it
      // (e.g. uploader vs deleter mismatch) the row deletion already
      // succeeded, so we just log and move on.
      if (storagePath) {
        await supabase.storage.from('desenhos').remove([storagePath]).catch(() => undefined);
      }
    },
    onSuccess: (_, { solicitacaoId }) => {
      qc.invalidateQueries({ queryKey: ['solicitacao_drawings', solicitacaoId] });
    },
  });
}
