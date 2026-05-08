import { useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
import { ChevronDown, ChevronRight, MoreVertical, Plus, Edit3, Copy, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useMaterials } from '@/hooks/useSupabaseData';
import {
  buildBomTree, useBomNodes, useDuplicateBomSubtree, useMoveBomNode, useRemoveBomSubtree, useUpdateBomNode,
} from '@/hooks/useBomTree';
import type { BomTreeNode } from '@/types/bom';
import { BomNodeIcon, bomNodeTypeLabel } from './BomNodeIcon';
import { AddNodeDialog } from './AddNodeDialog';
import { EditNodeDialog } from './EditNodeDialog';

interface MaterialLite {
  id: string;
  descricao: string;
  bitola: string;
  unidade: string;
}

interface Props {
  versionId: string;
  readOnly: boolean;
  search?: string;
}

export function BomTreeView({ versionId, readOnly, search = '' }: Props) {
  const { data: nodes = [], isLoading } = useBomNodes(versionId);
  const { data: materials = [] } = useMaterials();
  const tree = useMemo(() => buildBomTree(nodes), [nodes]);
  const move = useMoveBomNode();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showCumulative, setShowCumulative] = useState(false);
  const [addState, setAddState] = useState<{ parentId: string } | null>(null);
  const [editNode, setEditNode] = useState<BomTreeNode | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BomTreeNode | null>(null);

  const matById = useMemo(() => {
    const m = new Map<string, MaterialLite>();
    for (const x of materials as MaterialLite[]) m.set(x.id, x);
    return m;
  }, [materials]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over || !e.active || readOnly) return;
    const draggedId = String(e.active.id);
    const targetId = String(e.over.id);
    if (draggedId === targetId) return;

    const map = new Map<string, BomTreeNode>();
    const walk = (n: BomTreeNode) => { map.set(n.id, n); n.children.forEach(walk); };
    if (tree) walk(tree);
    const target = map.get(targetId);
    const dragged = map.get(draggedId);
    if (!target || !dragged) return;
    if (target.node_type === 'ITEM') {
      toast.error('Items não podem ter filhos'); return;
    }
    // Trigger handles cycle/depth; client-side guard for the obvious case:
    if (dragged.node_type === 'CONJUNTO') {
      toast.error('O Conjunto raiz não pode ser movido'); return;
    }
    const newPos = (target.children?.length ?? 0);
    try {
      await move.mutateAsync({ versionId, nodeId: draggedId, newParentId: targetId, newPosition: newPos });
      setExpanded((p) => new Set(p).add(targetId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao mover');
    }
  };

  const matchesSearch = (n: BomTreeNode): boolean => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    if ((n.name ?? '').toLowerCase().includes(q)) return true;
    if (n.material_id) {
      const m = matById.get(n.material_id);
      if (m && (`${m.descricao} ${m.bitola}`).toLowerCase().includes(q)) return true;
    }
    return n.children.some(matchesSearch);
  };

  if (isLoading) return <div className="text-muted-foreground py-6">Carregando estrutura…</div>;
  if (!tree) return <div className="text-muted-foreground py-6">Sem nós nesta versão.</div>;

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{nodes.length} nó(s)</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCumulative((v) => !v)}
            title="Alternar quantidade acumulada"
          >
            {showCumulative ? 'Mostrar qtd. unitária' : 'Mostrar qtd. acumulada'}
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="border rounded-md p-2 bg-card">
          <NodeRow
            node={tree}
            depth={0}
            expanded={expanded}
            setExpanded={setExpanded}
            matById={matById}
            readOnly={readOnly}
            showCumulative={showCumulative}
            onAdd={(pid) => setAddState({ parentId: pid })}
            onEdit={(n) => setEditNode(n)}
            onDelete={(n) => setConfirmDelete(n)}
            visible={matchesSearch(tree)}
            search={search}
            siblings={1}
            siblingIndex={0}
          />
        </div>
      </DndContext>

      {addState && (
        <AddNodeDialog
          open
          onOpenChange={(o) => { if (!o) setAddState(null); }}
          versionId={versionId}
          parentId={addState.parentId}
        />
      )}
      <EditNodeDialog open={!!editNode} onOpenChange={(o) => { if (!o) setEditNode(null); }} node={editNode} />
      <DeleteConfirm node={confirmDelete} versionId={versionId} onClose={() => setConfirmDelete(null)} />
    </>
  );
}

interface RowProps {
  node: BomTreeNode;
  depth: number;
  expanded: Set<string>;
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
  matById: Map<string, MaterialLite>;
  readOnly: boolean;
  showCumulative: boolean;
  onAdd: (parentId: string) => void;
  onEdit: (n: BomTreeNode) => void;
  onDelete: (n: BomTreeNode) => void;
  visible: boolean;
  search: string;
  siblings: number;
  siblingIndex: number;
}

function NodeRow(props: RowProps) {
  const { node, depth, expanded, setExpanded, matById, readOnly, showCumulative, onAdd, onEdit, onDelete, search } = props;
  const isOpen = expanded.has(node.id) || (search.trim().length > 0);
  const hasChildren = node.children.length > 0;
  const isItem = node.node_type === 'ITEM';
  const isConjunto = node.node_type === 'CONJUNTO';

  const update = useUpdateBomNode();
  const duplicate = useDuplicateBomSubtree();

  const droppable = useDroppable({ id: node.id, disabled: readOnly || isItem });
  const draggable = useDraggable({ id: node.id, disabled: readOnly || isConjunto });

  const material = node.material_id ? matById.get(node.material_id) : null;
  const displayName = isItem
    ? (material ? `${material.descricao}${material.bitola ? ` — ${material.bitola}` : ''}` : '(item desconhecido)')
    : (node.name ?? '(sem nome)');
  const unit = isItem && material ? material.unidade : null;
  const qty = node.quantity ?? null;
  const cumQty = node.cumulativeQuantity;

  const toggle = () => setExpanded((p) => {
    const next = new Set(p);
    if (next.has(node.id)) next.delete(node.id); else next.add(node.id);
    return next;
  });

  const moveSibling = async (delta: -1 | 1) => {
    try {
      await update.mutateAsync({
        versionId: node.version_id,
        nodeId: node.id,
        position: node.position + delta,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao mover');
    }
  };

  return (
    <div ref={droppable.setNodeRef} className={droppable.isOver ? 'rounded bg-primary/10' : ''}>
      <div
        className="group flex items-center gap-1 py-1.5 px-1 rounded hover:bg-muted/40"
        style={{ paddingLeft: `${depth * 18 + 4}px` }}
        ref={draggable.setNodeRef}
        {...draggable.attributes}
      >
        {hasChildren ? (
          <button onClick={toggle} className="p-0.5 hover:bg-muted rounded" aria-label="Expandir">
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="inline-block w-[18px]" />
        )}

        <span
          className={readOnly || isConjunto ? '' : 'cursor-grab'}
          {...(!readOnly && !isConjunto ? draggable.listeners : {})}
        >
          <BomNodeIcon type={node.node_type} />
        </span>

        <span className="font-medium truncate" title={displayName}>{displayName}</span>

        {!isConjunto && qty != null && (
          <Badge variant="outline" className="ml-2 font-mono text-xs"
                 title={showCumulative ? 'Quantidade acumulada' : 'Quantidade unitária'}>
            {showCumulative ? cumQty : qty}{unit ? ` ${unit}` : ''}
          </Badge>
        )}

        <Badge variant="secondary" className="ml-1 text-[10px]">
          {bomNodeTypeLabel(node.node_type)}
        </Badge>

        {!readOnly && (
          <div className="ml-auto flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            {!isItem && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Adicionar nó"
                onClick={(e) => { e.stopPropagation(); onAdd(node.id); }}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => onEdit(node)}>
                  <Edit3 className="h-3.5 w-3.5 mr-2" /> Editar
                </DropdownMenuItem>
                {!isConjunto && (
                  <>
                    <DropdownMenuItem onClick={() => moveSibling(-1)}>
                      <ArrowUp className="h-3.5 w-3.5 mr-2" /> Mover para cima
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => moveSibling(1)}>
                      <ArrowDown className="h-3.5 w-3.5 mr-2" /> Mover para baixo
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={async () => {
                        try {
                          await duplicate.mutateAsync({ versionId: node.version_id, nodeId: node.id });
                          toast.success('Subárvore duplicada');
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : 'Erro ao duplicar');
                        }
                      }}
                    >
                      <Copy className="h-3.5 w-3.5 mr-2" /> Duplicar subárvore
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onDelete(node)} className="text-destructive">
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Remover
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {isOpen && hasChildren && (
        <div>
          {node.children.map((c, i) => (
            <NodeRow
              key={c.id}
              node={c}
              depth={depth + 1}
              expanded={expanded}
              setExpanded={setExpanded}
              matById={matById}
              readOnly={readOnly}
              showCumulative={showCumulative}
              onAdd={onAdd}
              onEdit={onEdit}
              onDelete={onDelete}
              visible
              search={search}
              siblings={node.children.length}
              siblingIndex={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DeleteConfirm({
  node, versionId, onClose,
}: { node: BomTreeNode | null; versionId: string; onClose: () => void }) {
  const remove = useRemoveBomSubtree();
  if (!node) return null;
  const hasChildren = node.children.length > 0;
  return (
    <AlertDialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover nó?</AlertDialogTitle>
          <AlertDialogDescription>
            {hasChildren
              ? `Este nó possui ${node.children.length} filho(s). Toda a subárvore será removida.`
              : 'Esta ação remove o nó selecionado.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              try {
                await remove.mutateAsync({ versionId, nodeId: node.id });
                toast.success('Nó removido');
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Erro ao remover');
              } finally {
                onClose();
              }
            }}
          >
            Remover
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
