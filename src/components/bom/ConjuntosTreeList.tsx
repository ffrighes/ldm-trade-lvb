import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  useBomRoots,
  useBomVersions,
  useDeleteBomRoot,
  useDropBomRootCascade,
  buildRootTree,
} from '@/hooks/useBomTree';
import { usePermissions } from '@/hooks/usePermissions';
import { BomNodeIcon } from '@/components/bom/BomNodeIcon';
import { EditConjuntoDialog } from '@/components/bom/EditConjuntoDialog';
import type { BomRootTreeNode } from '@/types/bom';

interface Props {
  projectId: string;
}

const EXPAND_KEY = (projectId: string) => `bom-tree-expanded-${projectId}`;

function loadExpanded(projectId: string): Set<string> {
  try {
    const raw = localStorage.getItem(EXPAND_KEY(projectId));
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* ignore */ }
  return new Set();
}

function saveExpanded(projectId: string, ids: Set<string>) {
  try {
    localStorage.setItem(EXPAND_KEY(projectId), JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

// ── Delete confirmation state ─────────────────────────────────────────────────

type DeleteTarget = {
  rootId: string;
  codigo: string;
  hasChildren: boolean;
};

// ── Tree node row ─────────────────────────────────────────────────────────────

interface NodeRowProps {
  node: BomRootTreeNode;
  selectedRootId: string | undefined;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (target: DeleteTarget) => void;
  canEdit: boolean;
  canDelete: boolean;
}

function NodeRow({
  node,
  selectedRootId,
  expanded,
  onToggle,
  onSelect,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: NodeRowProps) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isSelected = node.id === selectedRootId;
  const indent = node.depth * 14;

  return (
    <>
      <li className="group flex items-center gap-0.5" style={{ paddingLeft: indent }}>
        {/* expand/collapse toggle (14 px reserved even for leaves for alignment) */}
        <span className="w-5 h-6 flex items-center justify-center shrink-0">
          {hasChildren ? (
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}
              className="rounded hover:bg-muted p-0.5 transition-colors"
              aria-label={isExpanded ? 'Recolher' : 'Expandir'}
            >
              {isExpanded
                ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          ) : null}
        </span>

        <button
          className={`flex-1 text-left px-1.5 py-1.5 rounded hover:bg-muted text-sm flex items-start gap-2 min-w-0 ${
            isSelected ? 'bg-muted font-medium' : ''
          }`}
          onClick={() => onSelect(node.id)}
        >
          <span className="pt-0.5 shrink-0"><BomNodeIcon type="CONJUNTO" /></span>
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="font-mono text-xs text-muted-foreground">{node.codigo}</span>
            <span className="break-words text-xs">{node.name}</span>
          </span>
        </button>

        {canEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            aria-label={`Editar Conjunto ${node.codigo}`}
            title="Editar"
            onClick={(e) => { e.stopPropagation(); onEdit(node.id); }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}

        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            aria-label={`Excluir Conjunto ${node.codigo}`}
            title="Excluir"
            onClick={(e) => {
              e.stopPropagation();
              onDelete({ rootId: node.id, codigo: node.codigo, hasChildren: hasChildren });
            }}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        )}
      </li>

      {hasChildren && isExpanded && node.children.map((child) => (
        <NodeRow
          key={child.id}
          node={child}
          selectedRootId={selectedRootId}
          expanded={expanded}
          onToggle={onToggle}
          onSelect={onSelect}
          onEdit={onEdit}
          onDelete={onDelete}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      ))}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ConjuntosTreeList({ projectId }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedRootId = searchParams.get('rootId') ?? undefined;

  const { data: roots = [], isLoading } = useBomRoots(projectId);
  const { canEditBomDraft, canDeleteBomRoot } = usePermissions();
  const deleteRoot = useDeleteBomRoot();
  const dropCascade = useDropBomRootCascade();

  const [expanded, setExpanded] = useState<Set<string>>(() => loadExpanded(projectId));
  const [editRootId, setEditRootId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  // Persist expansion state
  useEffect(() => { saveExpanded(projectId, expanded); }, [projectId, expanded]);

  // Auto-expand ancestors of the selected root when the selection changes
  useEffect(() => {
    if (!selectedRootId || roots.length === 0) return;
    const parentMap = new Map(roots.map((r) => [r.id, r.parent_id]));
    const toExpand = new Set<string>();
    let cursor = parentMap.get(selectedRootId);
    while (cursor) {
      toExpand.add(cursor);
      cursor = parentMap.get(cursor) ?? null;
    }
    if (toExpand.size > 0) {
      setExpanded((prev) => {
        const next = new Set(prev);
        toExpand.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [selectedRootId, roots]);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectRoot = useCallback((rootId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('rootId', rootId);
    next.delete('versionId');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const tree = buildRootTree(roots);
  const editingRoot = roots.find((r) => r.id === editRootId);

  const { data: editingVersions = [] } = useBomVersions(editRootId ?? undefined);
  const editingRootHasDraft = editingVersions.some((v) => v.status === 'DRAFT');

  const handleDeleteOrphan = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.rootId;
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
      setDeleteTarget(null);
    }
  };

  const handleDeleteCascade = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.rootId;
    try {
      await dropCascade.mutateAsync({ rootId: id, projectId });
      toast.success('Conjunto e seus filhos excluídos');
      if (selectedRootId === id) {
        const next = new URLSearchParams(searchParams);
        next.delete('rootId');
        next.delete('versionId');
        setSearchParams(next, { replace: true });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir');
    } finally {
      setDeleteTarget(null);
    }
  };

  if (isLoading) return <p className="text-xs text-muted-foreground px-2 py-1.5">Carregando…</p>;
  if (roots.length === 0) return <p className="text-xs text-muted-foreground px-2 py-1.5">Nenhum Conjunto neste projeto.</p>;

  return (
    <div className="px-1">
      <ul className="space-y-0.5">
        {tree.map((node) => (
          <NodeRow
            key={node.id}
            node={node}
            selectedRootId={selectedRootId}
            expanded={expanded}
            onToggle={toggle}
            onSelect={selectRoot}
            onEdit={setEditRootId}
            onDelete={setDeleteTarget}
            canEdit={canEditBomDraft}
            canDelete={canDeleteBomRoot}
          />
        ))}
      </ul>

      <EditConjuntoDialog
        open={!!editRootId}
        onOpenChange={(o) => { if (!o) setEditRootId(null); }}
        projectId={projectId}
        rootId={editRootId}
        codigo={editingRoot?.codigo ?? ''}
        currentName={editingRoot?.name ?? ''}
        currentParentId={editingRoot?.parent_id ?? null}
        isDraft={editingRootHasDraft}
        allRoots={roots}
      />

      {/* Delete dialog — simple case (no children) */}
      <AlertDialog
        open={!!deleteTarget && !deleteTarget.hasChildren}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Conjunto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o Conjunto <strong>{deleteTarget?.codigo}</strong>, todas as suas
              versões e nós de estrutura. A operação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOrphan}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog — parent with children */}
      <AlertDialog
        open={!!deleteTarget?.hasChildren}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Conjunto com filhos?</AlertDialogTitle>
            <AlertDialogDescription>
              O Conjunto <strong>{deleteTarget?.codigo}</strong> possui Conjuntos filhos.
              Escolha como tratar os filhos:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2 space-y-2 text-sm text-muted-foreground">
            <p>
              <strong>Manter filhos na raiz</strong> — os filhos ficam sem pai (nível raiz).
            </p>
            <p>
              <strong>Excluir em cascata</strong> — remove este Conjunto e todos os seus
              descendentes, versões e nós de estrutura.
            </p>
          </div>
          <AlertDialogFooter className="flex-wrap gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={handleDeleteOrphan}
              disabled={deleteRoot.isPending || dropCascade.isPending}
            >
              Manter filhos na raiz
            </Button>
            <AlertDialogAction
              onClick={handleDeleteCascade}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir em cascata
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
