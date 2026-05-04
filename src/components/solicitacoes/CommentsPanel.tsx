import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, MessageSquare, Send, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useSolicitacaoComments, useAddComment, useDeleteComment } from '@/hooks/useSolicitacaoActivity';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Props {
  solicitacaoId: string;
}

const MAX_LENGTH = 2000;

function authorInitials(email: string): string {
  if (!email) return '?';
  const left = email.split('@')[0] ?? '';
  return left.slice(0, 2).toUpperCase() || '?';
}

export function CommentsPanel({ solicitacaoId }: Props) {
  const { user } = useAuth();

  const { data: comments = [], isLoading } = useSolicitacaoComments(solicitacaoId);
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();

  const [body, setBody] = useState('');

  const handleSubmit = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_LENGTH) {
      toast.error(`Comentário maior que ${MAX_LENGTH} caracteres`);
      return;
    }
    try {
      await addComment.mutateAsync({ solicitacaoId, body: trimmed });
      setBody('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao enviar comentário');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteComment.mutateAsync({ id, solicitacaoId });
      toast.success('Comentário removido');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover');
    }
  };

  const remaining = MAX_LENGTH - body.length;

  return (
    <div className="space-y-4">
      {user && (
        <div className="space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escreva um comentário..."
            rows={3}
            maxLength={MAX_LENGTH}
            aria-label="Novo comentário"
          />
          <div className="flex items-center justify-between">
            <span className={`text-xs ${remaining < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {remaining} caracteres restantes
            </span>
            <Button onClick={handleSubmit} disabled={!body.trim() || addComment.isPending} size="sm">
              {addComment.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Comentar
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-6 text-center text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />Carregando comentários…
        </div>
      ) : comments.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum comentário ainda.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => {
            const isOwn = !!user && c.author_id === user.id;
            const canDelete = true;
            return (
              <li key={c.id} className="flex gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="text-xs">{authorInitials(c.author_email)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium truncate">{c.author_email}</span>
                    <span
                      className="text-xs text-muted-foreground"
                      title={format(new Date(c.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                    >
                      {formatDistanceToNow(new Date(c.created_at), { locale: ptBR, addSuffix: true })}
                    </span>
                    {isOwn && <span className="text-xs text-muted-foreground">(você)</span>}
                    {canDelete && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 ml-auto text-muted-foreground hover:text-destructive"
                            aria-label="Excluir comentário"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir comentário?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(c.id)}>Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words mt-0.5">{c.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
