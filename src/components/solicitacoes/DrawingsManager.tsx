import { useRef, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExternalLink, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useSolicitacaoDrawings, useUploadDrawing, useDeleteDrawing } from '@/hooks/useSolicitacaoActivity';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Props {
  solicitacaoId: string;
  legacyDesenho?: string | null;
  isReadOnly?: boolean;
}

export function DrawingsManager({ solicitacaoId, legacyDesenho, isReadOnly }: Props) {
  const { user } = useAuth();

  const { data: drawings = [], isLoading } = useSolicitacaoDrawings(solicitacaoId);
  const uploadDrawing = useUploadDrawing();
  const deleteDrawing = useDeleteDrawing();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [revisao, setRevisao] = useState('');
  const [notas, setNotas] = useState('');

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Apenas arquivos PDF são permitidos');
      return;
    }
    setPendingFile(file);
  };

  const reset = () => {
    setPendingFile(null);
    setRevisao('');
    setNotas('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!pendingFile) return;
    if (!revisao.trim()) {
      toast.error('Informe a revisão (ex.: R0, R1, A)');
      return;
    }
    try {
      await uploadDrawing.mutateAsync({
        solicitacaoId,
        file: pendingFile,
        revisao: revisao.trim(),
        notas: notas.trim(),
      });
      toast.success(`Revisão "${revisao.trim()}" enviada`);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao enviar desenho');
    }
  };

  const handleDelete = async (id: string, storagePath: string | null, label: string) => {
    try {
      await deleteDrawing.mutateAsync({ id, solicitacaoId, storagePath });
      toast.success(`Revisão "${label}" removida`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover');
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload form */}
      {!isReadOnly && user && (
        <div className="rounded-md border p-3 space-y-3 bg-muted/20">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Upload className="h-4 w-4" />
            Anexar nova revisão
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-2">
            <div>
              <Label htmlFor="drawing-file" className="text-xs">Arquivo PDF</Label>
              <Input
                id="drawing-file"
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={onFilePicked}
                disabled={uploadDrawing.isPending}
              />
              {pendingFile && (
                <p className="text-xs text-muted-foreground mt-1 truncate">{pendingFile.name}</p>
              )}
            </div>
            <div>
              <Label htmlFor="drawing-rev" className="text-xs">Revisão</Label>
              <Input
                id="drawing-rev"
                placeholder="R0, R1, A..."
                value={revisao}
                onChange={(e) => setRevisao(e.target.value)}
                maxLength={20}
                disabled={uploadDrawing.isPending}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="drawing-notas" className="text-xs">Notas (opcional)</Label>
            <Textarea
              id="drawing-notas"
              placeholder="Mudanças desta revisão..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              maxLength={500}
              disabled={uploadDrawing.isPending}
            />
          </div>
          <div className="flex justify-end gap-2">
            {(pendingFile || revisao || notas) && (
              <Button variant="outline" size="sm" onClick={reset} disabled={uploadDrawing.isPending}>
                Cancelar
              </Button>
            )}
            <Button size="sm" onClick={handleUpload} disabled={!pendingFile || uploadDrawing.isPending}>
              {uploadDrawing.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Enviar
            </Button>
          </div>
        </div>
      )}

      {/* Drawings list */}
      {isLoading ? (
        <div className="py-6 text-center text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />Carregando…
        </div>
      ) : (
        <div className="space-y-2">
          {legacyDesenho && (
            <div className="flex items-center gap-3 rounded-md border p-2.5 bg-muted/20">
              <FileText className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">Desenho atual (legado)</div>
                <div className="text-xs text-muted-foreground">No campo "desenho" da solicitação</div>
              </div>
              <a href={legacyDesenho} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" asChild aria-label="Abrir desenho legado">
                  <span><ExternalLink className="h-4 w-4" /></span>
                </Button>
              </a>
            </div>
          )}

          {drawings.length === 0 && !legacyDesenho ? (
            <div className="py-6 text-center text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhuma revisão anexada.</p>
            </div>
          ) : (
            drawings.map((d) => {
              const canDelete = !isReadOnly;
              return (
                <div key={d.id} className="flex items-start gap-3 rounded-md border p-2.5">
                  <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-medium">Revisão {d.revisao || '—'}</span>
                      <span
                        className="text-xs text-muted-foreground"
                        title={format(new Date(d.uploaded_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                      >
                        {formatDistanceToNow(new Date(d.uploaded_at), { locale: ptBR, addSuffix: true })}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      por {d.uploaded_by_email ?? 'desconhecido'}
                    </div>
                    {d.notas && <div className="text-xs mt-1 whitespace-pre-wrap break-words">{d.notas}</div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a href={d.url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" asChild aria-label={`Abrir revisão ${d.revisao}`}>
                        <span><ExternalLink className="h-4 w-4" /></span>
                      </Button>
                    </a>
                    {canDelete && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" aria-label={`Excluir revisão ${d.revisao}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir revisão {d.revisao}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              O arquivo PDF e o registro serão removidos. Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(d.id, d.storage_path, d.revisao || '—')}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
