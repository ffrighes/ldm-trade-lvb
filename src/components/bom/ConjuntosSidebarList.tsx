import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useBomRoots, useBomVersions, useDeleteBomRoot } from '@/hooks/useBomTree';
import { usePermissions } from '@/hooks/usePermissions';
import { BomNodeIcon } from '@/components/bom/BomNodeIcon';
import { EditConjuntoDialog } from '@/components/bom/EditConjuntoDialog';

interface Props {
  projectId: string;
}

export function ConjuntosSidebarList({ projectId }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedRootId = searchParams.get('rootId') ?? undefined;

  const { data: roots = [], isLoading } = useBomRoots(projectId);
  const { canEditBomDraft, canDeleteBomRoot } = usePermissions();
  const deleteRoot = useDeleteBomRoot();

  const [editRootId, setEditRootId] = useState<string | null>(null);
  const [confirmDeleteRootId, setConfirmDeleteRootId] = useState<string | null>(null);

  const { data: editingVersions = [] } = useBomVersions(editRootId ?? undefined);
  const editingRootHasDraft = editingVersions.some((v) => v.status === 'DRAFT');

  const selectRoot = (rootId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('rootId', rootId);
    next.delete('versionId');
    setSearchParams(next, { replace: true });
  };

  const editingRoot = roots.find((r) => r.id === editRootId);

  return (
    <div className="px-1">
      {isLoading ? (
        <p className="text-xs text-muted-foreground px-2 py-1.5">Carregando…</p>
      ) : roots.length === 0 ? (
        <p className="text-xs text-muted-foreground px-2 py-1.5">Nenhum Conjunto neste projeto.</p>
      ) : (
        <ul className="space-y-0.5">
          {roots.map((r) => (
            <li key={r.id} className="group flex items-center gap-1">
              <button
                className={`flex-1 text-left px-2 py-1.5 rounded hover:bg-muted text-sm flex items-start gap-2 min-w-0 ${
                  r.id === selectedRootId ? 'bg-muted font-medium' : ''
                }`}
                onClick={() => selectRoot(r.id)}
              >
                <span className="pt-0.5"><BomNodeIcon type="CONJUNTO" /></span>
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="font-mono text-xs text-muted-foreground">
                    {r.codigo}
                    {r.parent_id && r.quantity_in_parent !== 1 && (
                      <span className="ml-1 text-muted-foreground">×{r.quantity_in_parent}</span>
                    )}
                  </span>
                  <span className="break-words text-xs">{r.name}</span>
                </span>
              </button>
              {canEditBomDraft && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`Editar descrição do Conjunto ${r.codigo}`}
                  title="Editar descrição"
                  onClick={(e) => { e.stopPropagation(); setEditRootId(r.id); }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              {canDeleteBomRoot && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`Excluir Conjunto ${r.codigo}`}
                  title="Excluir Conjunto"
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteRootId(r.id); }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <EditConjuntoDialog
        open={!!editRootId}
        onOpenChange={(o) => { if (!o) setEditRootId(null); }}
        projectId={projectId}
        rootId={editRootId}
        codigo={editingRoot?.codigo ?? ''}
        currentName={editingRoot?.name ?? ''}
        isDraft={editingRootHasDraft}
        currentParentId={editingRoot?.parent_id ?? null}
        currentQuantityInParent={editingRoot?.quantity_in_parent ?? 1}
        allRoots={roots}
      />

      <AlertDialog
        open={!!confirmDeleteRootId}
        onOpenChange={(o) => { if (!o) setConfirmDeleteRootId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Conjunto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o Conjunto, todas as suas versões (incluindo RELEASED e
              OBSOLETE) e todos os nós da estrutura. A operação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDeleteRootId) return;
                const id = confirmDeleteRootId;
                try {
                  await deleteRoot.mutateAsync({ rootId: id, projectId });
                  toast.success('Conjunto excluído');
                  if (selectedRootId === id) {
                    const next = new URLSearchParams(searchParams);
                    next.delete('rootId');
                    next.delete('versionId');
                    setSearchParams(next, { replace: true });
                  }
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Erro ao excluir');
                } finally {
                  setConfirmDeleteRootId(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
